import puppeteer,{ Page } from 'puppeteer';
import * as fs from 'fs/promises'; 
import * as path from "path";
function extractTextAndNumber(input: string){
  if (input==null)
    return null
  const match = input.match(/^(.*)\s*\((\d+)\)$/);
  return match ? { text: match[1].trim(), id: match[2] } : null;
}
async function page_waitForSelector(page:Page,selector_id:string){
  await page.waitForSelector(selector_id, {
    visible: true,
    timeout: 10000
  });
    // Wait a bit more to ensure all options are loaded
  await new Promise(resolve => setTimeout(resolve, 1000));
}
export async function page_wait_and_click(page:Page,selector_id:string){
  await page.waitForSelector(selector_id, {
    visible: true,
    timeout: 10000
  });
    // Wait a bit more to ensure all options are loaded
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.click(selector_id)
}
export async function type_at_selector(page:Page,id:string,text:string){
  // Wait for the faculty input element to be available
  console.log(`typing... ${id} '${text}'`);
  await page_waitForSelector(page,id);
  await page.click(id);
  await page.type(id, text);
}
export async function download_from_selector(page:Page,id:string){
  await page_waitForSelector(page,id)

  // Extract all items from the dropdown
  console.log('download_from_selector...',id);
  const items = await page.evaluate((id)=>{
    const dropdown=document.querySelector(id)
    if (!dropdown) return [];
    return Array.from(dropdown.querySelectorAll('li')).map(el=>el.textContent)

  },id)
  const ans=[]
  for (const item of items){
    if (item==null)
      continue
    const parsed=extractTextAndNumber(item)
    if (parsed!=null)
      ans.push(parsed)
  }
  return ans
}
export async function page_goto(page:Page,url:string){
  console.log(url)
   await page.goto(url, {
    waitUntil: 'load',
    timeout: 30000
  });
}
export async function fd_read_file(filename:string){
  const ans = await fs.readFile(filename,'utf8')
  console.log('readfile:',filename,ans.length)
  return ans
}
export async function fd_read_json_file<T extends object>(filename:string){
  const ans = await fd_read_file(filename)
  const jsonans = JSON.parse(ans)
  return jsonans as T
}
export async function fs_write_file(filename:string,str:string){
  console.log('save ',filename,str.length,' chars')  
  await fs.writeFile(filename,str)
}
export async function fs_write_json_file(filename:string,data:object){
  const str=JSON.stringify(data, null, 2)
  await fs_write_file(filename,str)

}
interface RequestInitEx extends RequestInit{
   dbgline:string
   timeout:number
}
export async function repeat_fetch(
  input: RequestInfo | URL, 
  init?: RequestInitEx

): Promise<string|undefined> {
 const start=Date.now();
  const { timeout = undefined, dbgline = input.toString() } = init || {};
  for (let attempt=0;;attempt++)
  try{
    const controller = new AbortController();
    const {signal}=controller
    if (timeout!=null)
      setTimeout(() => controller.abort(), timeout);
    const response = await fetch(input,{...init,signal})
    if (!response.ok){
      console.warn(dbgline,'bad response status:',response.status)
      return
    }
    const ans = await response.text();
    const end=Date.now();
    console.log(dbgline,ans.length,end-start)
    return ans 
  }catch(ex){
    console.log('attempt',attempt,":",(ex as Error).message,dbgline)
  }
}


export async function do_post(url:string,post_data:string,timeout=10000){
    return await repeat_fetch(url, {
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
    timeout,
    dbgline:post_data
  })
}
export async function filecache(filename:string,func: () => Promise<string|undefined>){
  try{
    await fd_read_file(filename)
    return                      
  }catch(_ex){
    console.debug(`Cache miss for ${filename}:`);
  }
  try{
    const content=await func()
    if (content==null)
      return //already warned
    fs_write_file(filename,content)
  }catch(_ex){ 
    console.warn(`file write error for  ${filename}:`);
  }

}


export async function createDirs() {
  const dirs = [
    "data",
    "data/css",
    "data/downloaded",
    "data/kedem",
    "data/parsed",
    "data/silabus",
    "data/tochniot",
    "data/examDates",
  ];

  for (const dir of dirs) {
    const fullPath = path.resolve(dir);
    await fs.mkdir(fullPath, { recursive: true });
  }
}
export async function make_browser(){
   return await puppeteer.launch({
    headless: false, // Set to true for headless mode
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}