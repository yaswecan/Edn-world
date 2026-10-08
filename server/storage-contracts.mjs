const text={type:'string',minLength:1},hash={type:'string',pattern:'^[a-f0-9]{64}$'};
const file={type:'object',required:['path','sha256'],properties:{path:text,sha256:hash,bytes:{type:'integer',minimum:0},audience:{enum:['student','teacher','private']}}};
export const snapshotManifestSchema={
 $id:'EDEN.ContentSnapshotManifest.v1',type:'object',additionalProperties:false,
 required:['schemaVersion','id','event','eventId','subject','acceptedAt','versions','files','external'],
 properties:{schemaVersion:{const:1},id:text,event:text,eventId:text,subject:{type:'object'},acceptedAt:text,versions:{type:'object'},files:{type:'array',minItems:1,maxItems:200,items:file},external:{type:'array',items:file}}
};
export const documentContextSchema={
 $id:'EDEN.DocumentContext.v1',type:'object',additionalProperties:false,
 required:['version','taxonomyVersion','strategy','scope','searches','passages','omitted','maxCharacters','characters'],
 properties:{version:{const:1},taxonomyVersion:text,strategy:text,scope:{type:'array',items:{type:'object',required:['sourceId','sourceHash','version','buildId','annotationVersion'],properties:{sourceId:text,sourceHash:hash,version:{type:'integer',minimum:1},buildId:text,annotationVersion:{type:'integer',minimum:0}}}},searches:{type:'array'},passages:{type:'array',items:{type:'object',required:['sourceId','sourceHash','segmentId','location','sha256','text'],properties:{sourceId:text,sourceHash:text,segmentId:text,location:text,sha256:hash,text}}},omitted:{type:'array'},maxCharacters:{type:'integer',minimum:1},characters:{type:'integer',minimum:0}}
};
