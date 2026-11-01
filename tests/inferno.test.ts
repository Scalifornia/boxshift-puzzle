import { describe, expect, it } from 'vitest';
import { createInfernoState, findInfernoSolution, infernoMove, INFERNO_LEVELS } from '../src/inferno';
import type { InfernoLevel } from '../src/inferno';
import { consumeHint, consumeJoker, freshSave, loadSave, recordWin, saveData } from '../src/storage';

const room = (changes:Partial<InfernoLevel>={}):InfernoLevel => ({
  id:1,name:'Rules fixture',difficulty:'easy',width:7,height:3,walls:[],
  floor:[8,9,10,11,12],goals:[12],boxes:[10],player:8,solution:[],par:6,
  exit:12,doors:[],hazards:[],enemies:[],budget:12,...changes,
});
const memory = () => { const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}} as Storage; };

describe('Infernal Descent action rules',()=>{
  it('kicks a single block without walking, but never pulls or kicks two together',()=>{
    const l=room(),start=createInfernoState(l);
    const walk=infernoMove(l,start,'right');
    const kick=infernoMove(l,walk.state,'right');
    expect(kick).toMatchObject({event:'kick',pushed:true,cost:1});
    expect(kick.state).toMatchObject({player:9,boxes:[11],moves:2,pushes:1,spent:2,phase:0});
    expect(infernoMove(l,kick.state,'left').state.boxes).toEqual([11]);
    const two=room({boxes:[9,10]});expect(infernoMove(two,createInfernoState(two),'right')).toMatchObject({moved:false,cost:0});
    expect(start.boxes).toEqual([10]);
  });
  it('blocked actions preserve phase, budget and input state',()=>{
    const l=room(),state=createInfernoState(l);
    expect(infernoMove(l,state,'left')).toMatchObject({state,moved:false,event:'blocked',cost:0});
  });
  it('strikes a sentinel in place and frees its tile on the next action',()=>{
    const l=room({boxes:[],enemies:[9]});const state=createInfernoState(l);
    const hit=infernoMove(l,state,'right');expect(hit).toMatchObject({event:'strike',state:{player:8,enemies:[],spent:1,phase:1}});
    expect(infernoMove(l,hit.state,'right').state.player).toBe(9);expect(state.enemies).toEqual([9]);
  });
  it('a collected key opens doors, while an uncollected key prevents an exit win',()=>{
    const l=room({boxes:[],key:9,doors:[10]});
    expect(infernoMove(l,{...createInfernoState(l),player:9},'right').moved).toBe(false);
    const key=infernoMove(l,createInfernoState(l),'right');expect(key).toMatchObject({event:'key',state:{hasKey:true,doors:[]}});
    expect(infernoMove(l,key.state,'right').state.player).toBe(10);
    const noKey=infernoMove(l,{...createInfernoState(l),player:11},'right');expect(noKey.state.status).toBe('playing');
  });
  it('only entering a trap lit in the shown phase adds two steps',()=>{
    const l=room({boxes:[],hazards:[{cell:9,phase:0}]});
    const lit=infernoMove(l,createInfernoState(l),'right');expect(lit).toMatchObject({event:'trap',cost:3,state:{spent:3,phase:1}});
    const safe=infernoMove(l,{...createInfernoState(l),phase:1},'right');expect(safe).toMatchObject({cost:1,state:{spent:1,phase:0}});
  });
  it('permits escape on the last step and makes failure terminal otherwise',()=>{
    const l=room({boxes:[],exit:9,goals:[9],budget:1});
    const won=infernoMove(l,createInfernoState(l),'right');expect(won.state.status).toBe('won');
    expect(infernoMove(l,won.state,'left').moved).toBe(false);
    const exhausted=room({boxes:[],budget:1});const failed=infernoMove(exhausted,createInfernoState(exhausted),'right');
    expect(failed.state.status).toBe('failed');expect(infernoMove(exhausted,failed.state,'right').moved).toBe(false);
  });
});

describe('Original campaign and independent validation',()=>{
  it('has twelve different enclosed rooms with progressively tighter limits',()=>{
    expect(INFERNO_LEVELS).toHaveLength(12);
    expect(new Set(INFERNO_LEVELS.map(l=>l.floor.join(',')) ).size).toBe(12);
    for(const l of INFERNO_LEVELS){
      expect(l.floor).toContain(l.player);expect(l.floor).toContain(l.exit);
      expect(l.floor.every(c=>c>=0&&c<l.width*l.height&&!l.walls.includes(c))).toBe(true);
      expect(l.solution.length).toBeGreaterThanOrEqual(12);
      expect(l.boxes.length).toBeGreaterThan(0);
    }
    expect(INFERNO_LEVELS.slice(8).every(l=>l.solution.length>=30&&l.hazards.length===5&&l.key!==undefined)).toBe(true);
  });
  it.each(INFERNO_LEVELS)('room $id replays its route and solves without consulting it',l=>{
    const reference=l.solution.reduce((s,d)=>infernoMove(l,s,d).state,createInfernoState(l));
    expect(reference.status).toBe('won');expect(reference.spent).toBeLessThanOrEqual(l.budget);
    const route=findInfernoSolution({...l,solution:[]},createInfernoState(l),{maxNodes:250_000,timeoutMs:2500});
    expect(route).not.toBeNull();const solved=route!.reduce((s,d)=>infernoMove(l,s,d).state,createInfernoState(l));
    expect(solved.status).toBe('won');expect(solved.spent).toBeLessThanOrEqual(reference.spent);
    if(l.id>=9)expect(l.budget-solved.spent).toBe(0);
  });
  it('keeps searches bounded and never invents a hint after exhaustion',()=>{
    const l=INFERNO_LEVELS[11];expect(findInfernoSolution(l,createInfernoState(l),{maxNodes:0})).toBeNull();
    expect(findInfernoSolution(l,{...createInfernoState(l),status:'failed'})).toBeNull();
  });
});

describe('Infernal progress preserves existing campaigns',()=>{
  it('round-trips keys, enemies, trap phase, history and shared aid limits',()=>{
    const storage=memory(),l=INFERNO_LEVELS[4],save=freshSave();
    const start=createInfernoState(l),next=infernoMove(l,start,l.solution[0]).state;
    save.settings.theme='inferno';save.session={levelId:l.id,mode:'inferno',state:next,history:[start],seconds:7,undos:0};
    consumeHint(save,l.id,'inferno');consumeHint(save,l.id,'inferno');consumeJoker(save,l.id,'inferno');saveData(save,storage);
    const loaded=loadSave(storage);expect(loaded.session).toEqual(save.session);expect(loaded.settings.theme).toBe('inferno');
    expect(consumeHint(loaded,l.id,'inferno')).toBe(false);expect(consumeJoker(loaded,l.id,'inferno')).toBe(false);
    loaded.session!.state.boxes.push(400);expect(loadSave(storage).session!.state.boxes).not.toContain(400);
  });
  it('isolates infernal records and rejects out-of-range room IDs',()=>{
    const save=freshSave();save.unlocked=8;save.records['1']={moves:31,pushes:12,seconds:20,stars:3,undos:0};
    const result={moves:12,pushes:3,seconds:14,stars:3,undos:0};
    const won=recordWin(save,1,'inferno',result).data;
    expect(won.unlocked).toBe(8);expect(won.records['1']).toEqual(save.records['1']);expect(won.records['inferno:1']).toEqual(result);
    expect(recordWin(won,13,'inferno',result).data.records['inferno:13']).toBeUndefined();
  });
});
