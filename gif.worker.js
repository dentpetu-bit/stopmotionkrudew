/* Local wrapper for gif.js worker.
   แก้ปัญหา Failed to construct Worker เพราะ browser ห้ามเรียก worker ข้าม origin
*/
importScripts('https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js');
