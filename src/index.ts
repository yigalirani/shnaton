import { Browser } from 'puppeteer';
import * as utils from './utils'
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { createHash } from 'node:crypto';
const limit = pLimit(2);
const header=`<html lang="he" dir="rtl">
    <head>
        <base href="https://shnaton.huji.ac.il/index.php">
        <title>Shnaton</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="shortcut icon" href="img/favicon.ico" type="image/vnd.microsoft.icon" />
        <link rel="stylesheet" href="css/screen.css" />
        <link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css" />
        <link rel="stylesheet" href="jAlert/jAlert.css" />
        <link rel="stylesheet" href="css/custom.css" />
        <link rel="stylesheet" href="jbility/css/jbility.css" />
        <link href="css/print.css" media="print" rel="stylesheet" type="text/css" />
    </head>
`
interface FacultyData{
  id:string,
  text:string
}
function md5(content:string) {
  return createHash('md5').update(content).digest('hex');
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

async function _download_courses_of_one_dept_puppeter(browser:Browser,faculty_id:number,department_id:number){
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
    const page_data=await utils.do_post(url,post_data)
    if (page_data==null)
      throw 'failed'+post_data
    ans.push(strip_html(page_data))
    const more=has_more(page,page_data)
    if (!more){
      console.log('no more,page=',page)
      return ans.join("\n")
    }
  }
}
function make_filename(faculty_id: string, department_id: string){
  return `data/downloaded/${faculty_id}_${department_id}.html`
}
async function download_and_save_courses_of_one_dept(faculty_id: string, department_id: string) {
  const filename=make_filename(faculty_id,department_id)
  await utils.filecache(filename,()=>download_courses_of_one_dept(faculty_id, department_id))
}
async function download_department_data(browser:Browser):Promise<FacultyDataEx[]>{
  const facultyData:FacultyData[] = await scrapeFacultyOptions(browser);
  await utils.fs_write_json_file('data/faculty-options.json',facultyData)
  const department_data=await download_all_departments(browser,facultyData)
  await utils.fs_write_json_file('data/department_data.json',department_data)
  return department_data
}
function arrayToTable<T extends Record<string, any>>(data: T[]): string {
 if (!data.length) return '<table></table>';
 
 const headers = Object.keys(data[0]);
 const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
 const rows = data.map(row => 
   `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
 ).join('');
 
 return `<table>${headerRow}${rows}</table>`;
}
function extractCyllabusLink(html:string) {
  const $ = cheerio.load(html);
  const aTag = $('.cyllabus-cource');

  if (aTag.length === 0) {
    return null; // Anchor tag not found
  }

  const hrefValue = aTag.attr('href');
  if (!hrefValue || !hrefValue.startsWith("javascript:OpenUrl")) {
    return null; // Href not in the expected format
  }

  // Use a regular expression to extract the first argument of the OpenUrl function.
  // The expression looks for 'OpenUrl(' followed by a quote and captures the content until the next quote.
  const regex = /OpenUrl\('([^']*)'/;
  const match = hrefValue.match(regex);

  if (match && match.length > 1) {
    // The captured group [1] is the first argument, which contains the relative path.
    return match[1];
  }

  return null; // No match found
}
async function download_tocniot(course_number: string, faculty_id: string, detail: string) {
  const post_data = `peula=CourseD&detail=${detail}&course=${course_number}&year=2026&faculty=${faculty_id}`
  const url = 'https://shnaton.huji.ac.il/index.php'
  const content = await utils.do_post(url, post_data)
  if (content == null)
    throw 'failed to download tochniot for course ' + course_number
  return content
}
async function download_all_tocniot(detail: string) {
  const data = await utils.fd_read_json_file<{course_number: string, faculty_id: string}[]>('data/course_data.json')
  const funcs = data.map(({course_number, faculty_id}) => 
    limit(() => utils.filecache(`data/${detail}/${course_number}.html`, () => download_tocniot(course_number, faculty_id, detail)))
  )
  await Promise.all(funcs)
}
function make_parsed_filename(filename: string): string {
  const legs = filename.split('/')
  const ans= [legs[0],'parsed',legs[2]].join('/')
  return ans
}
async function parse_file(filename:string, faculty_id: string, course_data: {course_number: string, faculty_id: string}[]){
  const html=await utils.fd_read_file(filename)
  const $=cheerio.load(html)
  const exists = new Set();
  const rows=[]
  let dups=0
  let i=0
  for (const x of $('body').find('.card.medium')){
    const $x=$(x)
    const text=$x.text().replace(/\s+/g, '');
    const html=$x.html()
    if (html==null)
      continue
    const sum=md5(text)
    const data_course_title =$x.find('.data-course-title').text()
    const course_number=$x.find('.course-number').text()
    //if (course_number==='67100')
    //  console.log('67100',sum,html)
    if (exists.has(sum)){
      //console.log('exists',data_course_title)
      dups++
      continue
    }
    i++
    exists.add(sum)

    const data_course_title_en =$x.find('.data-course-title-en')
    const not_held_this_year =$x.find('.not-held-this-year')
    const silabus_link=extractCyllabusLink(html)
    if (silabus_link!=null)
      utils.filecache(`data/silabus/${course_number}.html`,()=>utils.repeat_fetch(`https://shnaton.huji.ac.il${silabus_link}`))
    course_data.push({course_number, faculty_id})
    const row={i,silabus_link,data_course_title,course_number,data_course_title_en,not_held_this_year,html:`<div class=card>${html}</div>`,sum}
    rows.push(row)//`<tr><td>${course_number}</td><td>${data_course_title}</td><td>${data_course_title_en}</td><td>${not_held_this_year}</td></tr>`) 
  }
  console.log({dups})
  const content=arrayToTable(rows)//`<table><tr><td>course_number</td><td>data_course_title</td><td>data_course_title_en</td><td>not_held_this_year</td></tr>${ans.join('\n')}</table>`
  await utils.fs_write_file(make_parsed_filename(filename),header+content)

}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function parse_all_file(){
  const data=await utils.fd_read_json_file<FacultyDataEx[]>('data/department_data.json')
  const course_data: {course_number: string, faculty_id: string}[] = []
  for (const {id:faculty_id,departments} of data)
    for (const {id:department_id} of departments)
      await parse_file(make_filename(faculty_id,department_id), faculty_id, course_data)
  await utils.fs_write_json_file('data/course_data.json', course_data)
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function read_and_save_all_courses(){
  const funcs=[]
  const data=await utils.fd_read_json_file<FacultyDataEx[]>('data/department_data.json')
  for (const {id:faculty_id,departments} of data)
    for (const {id:department_id} of departments)
       funcs.push(limit(()=>download_and_save_courses_of_one_dept(faculty_id, department_id)))

  await Promise.all(funcs);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function download_and_save_department_data(browser:Browser){
    const depts=await download_department_data(browser)
    await utils.fs_write_json_file('data/department_data.json',depts)
}

async function main() {
  await utils.createDirs()
  //const browser = await make_browser()
  //await read_and_save_all_courses()
  //download_and_save_courses_of_one_dept('09','0432')
  //download_and_save_department_data(browser)
  //const depts=await download_department_data(browser)
  //const cs=await download_courses_of_one_dept('12','0521')
  //await fs.writeFile('data/cs.html',cs)
  //await utils.fs_writeFile('data/department_data3.json',depts)
  //download_and_save_courses_of_one_dept('12','0521')
  //parse_file('data/12_0521.html')
  //parse_file('data/01_0115.html')
  //parse_all_file()
  //await download_all_tocniot('kedem')
  //await download_all_tocniot('tochniot')
  await download_all_tocniot('examDates')

}

// Run the script
main()