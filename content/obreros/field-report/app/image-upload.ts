type UploadResult={id:string;filename:string};

async function responseData(response:Response){
 const text=await response.text();
 try{return JSON.parse(text) as {id?:string;filename?:string;error?:string};}
 catch{return {error:text.trim()};}
}

export async function uploadImageFile(file:File,personId:string,headers:Record<string,string>={}):Promise<UploadResult>{
 if(!file.size)throw new Error('Selecciona una imagen.');
 if(file.size>12*1024*1024)throw new Error('Elige una imagen de menos de 12 MB.');
 const chunkSize=512*1024,uploadId=crypto.randomUUID(),total=Math.ceil(file.size/chunkSize);let result:{id?:string;filename?:string;error?:string}={};
 for(let index=0;index<total;index++){
  const response=await fetch('/api/images/import',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','X-CGV-Upload-Id':uploadId,'X-CGV-Person-Id':personId,'X-CGV-Filename':file.name,'X-CGV-File-Type':file.type||'application/octet-stream','X-CGV-Part-Index':String(index),'X-CGV-Part-Total':String(total)},body:file.slice(index*chunkSize,Math.min(file.size,(index+1)*chunkSize))});
  result=await responseData(response);
  if(!response.ok)throw new Error(result.error||(`No se pudo subir la imagen (${response.status}).`));
 }
 if(!result.id)throw new Error('La transferencia terminó sin guardar la imagen.');
 return {id:result.id,filename:result.filename||file.name};
}
