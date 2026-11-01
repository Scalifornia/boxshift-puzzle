import { findInfernoSolution } from './inferno';
import type { InfernoLevel, InfernoState } from './inferno';
self.onmessage = (event: MessageEvent<{ id:number; level:InfernoLevel; state:InfernoState }>) => {
  const {id,level,state}=event.data;
  self.postMessage({id,solution:findInfernoSolution(level,state,{maxNodes:100_000,timeoutMs:1800})});
};
