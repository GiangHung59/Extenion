import {safeName} from './core.js';

export function normalizeFolder(value) {
  if(typeof value!=='string')throw new Error('Tên thư mục không hợp lệ.');
  const folder=value.trim().replace(/\\/g,'/');
  if(!folder)return '';
  if(folder.startsWith('/')||folder.endsWith('/')||folder.length>180)throw new Error('Nhập tên thư mục con, không dùng đường dẫn tuyệt đối.');
  const parts=folder.split('/');
  for(const part of parts) {
    if(!part||part==='.'||part==='..'||part!==part.trim()||part.endsWith('.')||/[<>:"|?*\u0000-\u001f]/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
      throw new Error('Tên thư mục không hợp lệ. Ví dụ: Du an/Thang 9.');
  }
  return parts.join('/');
}

export function destinationFilename(folder, filename) {
  const path=normalizeFolder(folder);
  const base=safeName(filename.replace(/\\/g,'/').split('/').pop()||'download');
  return path?`${path}/${base}`:base;
}
