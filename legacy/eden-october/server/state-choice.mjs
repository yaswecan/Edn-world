/** A receipt timestamp is authoritative across runs; a revision is only comparable inside a run. */
export function chooseLatest(autoState,autoReceived,copy){
 if(!copy?.state)return autoState||null;
 if(!autoState)return copy.state;
 if(copy.state.runId===autoState.runId)return copy.state.revision>autoState.revision?copy.state:autoState;
 return Number(copy.created)>Number(autoReceived||0)?copy.state:autoState;
}
