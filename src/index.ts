/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs/promises'; 
import puppeteer, { Browser,Page } from 'puppeteer';
import * as utils from './utils'
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

const limit = pLimit(10);
interface FacultyData{
  id:string,
  text:string
}
interface FacultyDataEx extends FacultyData{
  departments: {
        text: string;
        id: string;
    }[];
}

async function scrapeFacultyOptions(browser: Browser) {
  const page = await browser.newPage();
  await utils.page_goto(page,'https://shnaton.huji.ac.il/')
  await utils.type_at_selector(page,'#facultyInput',' ')
  return await utils.download_from_selector(page,'#ui-id-1')
}

async function download_all_departments(browser: Browser, facultyData: FacultyData[]):Promise<FacultyDataEx[]>{
  const promises = facultyData.map(async (faculty) => {
    const { id } = faculty;
    const page = await browser.newPage();
    await utils.page_goto(page, `https://shnaton.huji.ac.il/index.php/default/NextForm/2026/${id}`);
    await utils.type_at_selector(page, '#chugInput',' ');
    const departments = await utils.download_from_selector(page, '#ui-id-2');
    await page.close();
    return {
      ...faculty,
      departments
    };
  });
  
  return await Promise.all(promises);
}

async function download_courses_of_one_dept_puppeter(browser:Browser,faculty_id:number,department_id:number){
  const page = await browser.newPage();
  await utils.page_goto(page, `https://shnaton.huji.ac.il/index.php/default/NextForm/2026/${faculty_id}`)
  const post_data = `year=2026&faculty=${faculty_id}&hug=${department_id}&maslul=0&peula=Advanced&starting=1&system=1&option=2&word=&course=&toar=&shana=&coursetype=0&shiur=&language=`
  const url = 'https://shnaton.huji.ac.il/index.php'
  //do the fetch inside the page and return the string
  const ans = await page.evaluate(async (url, postData) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData
    });
    return await response.text();
  }, url, post_data); 
  return ans 
}
async function do_post(url:string,post_data:string){
    const start=Date.now();
    
  for (let attempt=0;;attempt++)
  try{
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: post_data,
      signal:controller.signal
    });  
    const ans = await response.text();
    const end=Date.now();
    console.log(post_data,ans.length,end-start)
    return ans
  }catch(ex){
    console.log('attempt',attempt,":",(ex as Error).message)
  }

}
function has_more(page:number,page_data:string){
  if (page===1)
    return page_data.includes('loaded_more')
  return !page_data.includes(`$('#load_more').hide();`)
}
function strip_html(html:string) {
    const $ = cheerio.load(html);
    $('script').remove();
    return $('body').html();
}
async function download_courses_of_one_dept(faculty_id: string, department_id: string) {
  function calc_post_data(page:number){
    if (page===1)
      return `year=2026&faculty=${faculty_id}&hug=${department_id}&maslul=0&peula=Advanced&starting=1&system=1&option=2&word=&course=&toar=&shana=&coursetype=0&shiur=&language=`
    return `peula=Advanced&year=2026&starting=${page}&maximun=30&total=14&metoda=&word=0&hug=${department_id}&maslul=0&faculty=${faculty_id}&nosafim=1&arg=ajax`
  }
  const url = 'https://shnaton.huji.ac.il/index.php'
  const ans=[]
  for (let page=1;;page++){
    const post_data=calc_post_data(page)
    const page_data=await do_post(url,post_data)
    ans.push(strip_html(page_data))
    const more=has_more(page,page_data)
    if (!more){
      console.log('no more,page=',page)
      return ans.join("\n")
    }
  }
}
function make_filename(faculty_id: string, department_id: string){
  return `data/${faculty_id}_${department_id}.html`
}
async function download_and_save_courses_of_one_dept(faculty_id: string, department_id: string) {
  const filename=make_filename(faculty_id,department_id)
  try{
    await utils.fd_read_file(filename)
    return                      
  }catch(ex){
    const content=await download_courses_of_one_dept(faculty_id, department_id)
    utils.fs_write_file(filename,content)
    return 
  }
}
async function download_all_cources(browser:Browser,depts:FacultyDataEx[]){
}

async function download_department_data(browser:Browser):Promise<FacultyDataEx[]>{
  const facultyData:FacultyData[] = await scrapeFacultyOptions(browser);
  await utils.fs_write_json_file('data/faculty-options.json',facultyData)
  const department_data=await download_all_departments(browser,facultyData)
  await utils.fs_write_json_file('data/department_data.json',department_data)
  return department_data
}
async function parse_file(filename:string){
  const html=await utils.fd_read_file(filename)
  const $=cheerio.load(html)
  const ans=[]
  for (const x of $('body').find('.card.medium')){
    const $x=$(x)
    const course_number=$x.find('.course-number').text()
    const data_course_title =$x.find('.data-course-title')
    const data_course_title_en =$x.find('.data-course-title-en')
    const not_held_this_year =$x.find('.not-held-this-year')
    ans.push(`<tr><td>${course_number}</td><td>${data_course_title}</td><td>${data_course_title_en}</td><td>${not_held_this_year}</td></tr>`) 
  }
  const content=`<table><tr><td>course_number</td><td>data_course_title</td><td>data_course_title_en</td><td>not_held_this_year</td></tr>${ans.join('\n')}</table>`
  await utils.fs_write_file(filename+'.parsed.html',content)

}
async function read_and_save_all_courses(){
  const funcs=[]
  const data=await utils.fd_read_json_file<FacultyDataEx[]>('data/department_data.json')
  for (const {id:faculty_id,departments} of data)
    for (const {id:department_id} of departments)
       funcs.push(limit(()=>download_and_save_courses_of_one_dept(faculty_id, department_id)))

  await Promise.all(funcs);
}
async function download_and_save_department_data(browser:Browser){
    const depts=await download_department_data(browser)
    await utils.fs_write_json_file('data/department_data.json',depts)
}
async function make_browser(){
   return await puppeteer.launch({
    headless: false, // Set to true for headless mode
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}
async function main() {
  //const browser = await make_browser()
  await read_and_save_all_courses()
  //download_and_save_courses_of_one_dept('09','0432')
  //download_and_save_department_data(browser)
  //const depts=await download_department_data(browser)
  //const cs=await download_courses_of_one_dept('12','0521')
  //await fs.writeFile('data/cs.html',cs)
  //await utils.fs_writeFile('data/department_data3.json',depts)
  //download_and_save_courses_of_one_dept('12','0521')
  //parse_file('data/12_0521.html')
}

// Run the script
main();