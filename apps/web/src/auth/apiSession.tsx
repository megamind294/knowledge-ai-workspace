import { useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../api/apiClient";
import { DemoSessionContext, type DemoSessionValue, type DemoUser } from "./demoSession";

function user(value:{id:string;displayName:string;email:string}):DemoUser{return{id:value.id,name:value.displayName,email:value.email};}

export function ApiSessionProvider({children,client}:{children:React.ReactNode;client:ApiClient}) {
  const [current,setCurrent]=useState<DemoUser|null>(null); const [status,setStatus]=useState<DemoSessionValue["status"]>("restoring");
  useEffect(()=>{let active=true;client.restoreSession().then(session=>{if(active)setCurrent(user(session.user));}).catch(()=>{if(active)setCurrent(null);}).finally(()=>{if(active)setStatus("ready");});return()=>{active=false;};},[client]);
  const value=useMemo<DemoSessionValue>(()=>({
    user:current,mode:"api",status,
    startDemo(){throw new Error("Demo access requires fixture mode");},
    async login(input){const session=await client.login(input);setCurrent(user(session.user));},
    async register(input){const session=await client.register(input);setCurrent(user(session.user));},
    async endDemo(){await client.logout();setCurrent(null);},
  }),[client,current,status]);
  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}
