import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFolder,destinationFilename} from '../destination.js';

test('allow default root, Unicode subdirectories and Windows separators',()=>{
  assert.equal(normalizeFolder(''),'');
  assert.equal(normalizeFolder('  Dự án/Tháng 9  '),'Dự án/Tháng 9');
  assert.equal(normalizeFolder('Project\\Assets'),'Project/Assets');
});
test('reject absolute paths, traversal and invalid directory names',()=>{
  for(const path of ['/tmp/test','C:\\Users\\test','../Desktop','foo/../bar','foo//bar','foo/','foo/*','NUL','CON.txt','a/ . /b','a/zero\0'])assert.throws(()=>normalizeFolder(path),path);
});
test('save only server basename inside chosen subfolder, keep file extension',()=>{
  assert.equal(destinationFilename('Dự án','/Downloads/Thuyết trình.pptx'),'Dự án/Thuyết trình.pptx');
  assert.equal(destinationFilename('Work','C:\\Downloads\\Image.psd'),'Work/Image.psd');
  assert.equal(destinationFilename('','report.pdf'),'report.pdf');
});
