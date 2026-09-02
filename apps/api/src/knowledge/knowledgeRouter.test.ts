import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { issueAccessToken } from "../auth/tokens.js";
import { runMigrations } from "../database/migrate.js";
import type { DatabasePool } from "../database/pool.js";
import { createPgMemPool } from "../testSupport/pgMem.js";
import { PostgresKnowledgeRepository } from "./postgresKnowledgeRepository.js";

const secret=new TextEncoder().encode("test-only-secret-that-is-at-least-thirty-two-bytes");
const ids={owner:"00000000-0000-4000-8000-000000000001",viewer:"00000000-0000-4000-8000-000000000002",outsider:"00000000-0000-4000-8000-000000000003",workspace:"00000000-0000-4000-8000-000000000010",failed:"00000000-0000-4000-8000-000000000030"};
async function token(userId:string,email:string){return issueAccessToken({user:{id:userId,email,displayName:email},secret,now:new Date("2026-08-31T00:00:00Z"),ttlSeconds:60*60*24*365});}

describe.sequential("authorized knowledge API",()=>{
  let database:DatabasePool; let ownerToken:string; let viewerToken:string; let outsiderToken:string; let sequence=100;
  beforeEach(async()=>{
    database=createPgMemPool(); await runMigrations(database);
    await database.query("INSERT INTO users (id,email,display_name) VALUES ($1,'owner@example.com','Owner'),($2,'viewer@example.com','Viewer'),($3,'outsider@example.com','Outsider')",[ids.owner,ids.viewer,ids.outsider]);
    await database.query("INSERT INTO workspaces (id,owner_id,name,slug) VALUES ($1,$2,'Research','research')",[ids.workspace,ids.owner]);
    await database.query("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner'),($1,$3,'viewer')",[ids.workspace,ids.owner,ids.viewer]);
    await database.query("INSERT INTO documents (id,workspace_id,original_filename,media_type,size_bytes,ingestion_state,failure_reason) VALUES ($1,$2,'failed.pdf','application/pdf',100,'failed','parser error')",[ids.failed,ids.workspace]);
    ownerToken=await token(ids.owner,"owner@example.com"); viewerToken=await token(ids.viewer,"viewer@example.com"); outsiderToken=await token(ids.outsider,"outsider@example.com");
  });
  afterEach(async()=>database.end());
  function app(){return createApp({knowledge:{repository:new PostgresKnowledgeRepository(database,()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,"0")}`),accessTokenSecret:secret}});}
  function auth(value:string){return {Authorization:`Bearer ${value}`};}

  it("creates an owner membership atomically and exposes only joined workspaces",async()=>{
    const created=await request(app()).post("/api/workspaces").set(auth(outsiderToken)).send({name:"Product","slug":"product","description":"Roadmap"}).expect(201);
    const listed=await request(app()).get("/api/workspaces").set(auth(outsiderToken)).expect(200);
    expect(created.body.workspace.role).toBe("owner"); expect(listed.body.workspaces).toEqual([created.body.workspace]);
  });

  it("allows members to create scoped collections and document metadata, then deterministically retries failures",async()=>{
    const collection=await request(app()).post(`/api/workspaces/${ids.workspace}/collections`).set(auth(ownerToken)).send({name:"Policies","description":"HR"}).expect(201);
    const document=await request(app()).post(`/api/workspaces/${ids.workspace}/documents`).set(auth(ownerToken)).send({collectionId:collection.body.collection.id,originalFilename:"policy.pdf",mediaType:"application/pdf",sizeBytes:1200}).expect(201);
    expect(document.body.document.ingestionState).toBe("uploaded");
    const retried=await request(app()).post(`/api/workspaces/${ids.workspace}/documents/${ids.failed}/retry`).set(auth(ownerToken)).expect(200);
    expect(retried.body.document).toMatchObject({ingestionState:"processing",failureReason:null});
    await request(app()).post(`/api/workspaces/${ids.workspace}/documents/${ids.failed}/retry`).set(auth(ownerToken)).expect(409);
  });

  it("keeps viewers read-only and hides workspace existence from non-members",async()=>{
    await request(app()).get(`/api/workspaces/${ids.workspace}`).set(auth(viewerToken)).expect(200);
    await request(app()).post(`/api/workspaces/${ids.workspace}/collections`).set(auth(viewerToken)).send({name:"Nope"}).expect(403);
    await request(app()).get(`/api/workspaces/${ids.workspace}`).set(auth(outsiderToken)).expect(404);
    await request(app()).get(`/api/workspaces/${ids.workspace}/documents`).set(auth(outsiderToken)).expect(404);
  });

  it("rejects invalid and cross-workspace document metadata without persistence",async()=>{
    await request(app()).post(`/api/workspaces/${ids.workspace}/documents`).set(auth(ownerToken)).send({originalFilename:"bad.exe",mediaType:"application/octet-stream",sizeBytes:10}).expect(400);
    await request(app()).post(`/api/workspaces/${ids.workspace}/documents`).set(auth(ownerToken)).send({collectionId:"00000000-0000-4000-8000-000000000099",originalFilename:"safe.txt",mediaType:"text/plain",sizeBytes:10}).expect(404);
    const listed=await request(app()).get(`/api/workspaces/${ids.workspace}/documents`).set(auth(ownerToken)).expect(200);
    expect(listed.body.documents).toHaveLength(1);
  });
});
