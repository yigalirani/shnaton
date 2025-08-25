import { Page } from 'puppeteer';
import * as fs from 'fs/promises'; 
function extractTextAndNumber(input: string){
  if (input==null)
    return null
  const match = input.match(/^(.*)\s*\((\d+)\)$/);
  return match ? { text: match[1].trim(), id: parseInt(match[2], 10) } : null;
}
async function page_waitForSelector(page:Page,selector_id:string){
  await page.waitForSelector(selector_id, {
    visible: true,
    timeout: 10000
  });
    // Wait a bit more to ensure all options are loaded
  await new Promise(resolve => setTimeout(resolve, 1000));
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

export async function fd_read_file<T extends object>(){
  const ans = await fs.readFile('data/department_data.json','utf8')
  const jsonans = JSON.parse(ans)
  return jsonans as T
}
export async function fs_writeFile(filename:string,data:object){
  const str=JSON.stringify(data, null, 2)
  console.log('save ',filename,str.length,' chars')  
  await fs.writeFile(filename,str)
}