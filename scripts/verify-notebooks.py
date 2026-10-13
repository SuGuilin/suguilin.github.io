"""Execute the shipped notebook cells in an isolated temporary directory."""
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import sys
import re

root = Path(__file__).resolve().parent.parent
names = ['durable-agent.ipynb', 'paired-agent-evaluation.ipynb', 'agent-mechanism-checks.ipynb', 'decision-calibration.ipynb']
foundations=['llm-contract','retrieval-rag','context-engineering','agent-security','multi-agent','inference-serving']
names.extend([name+'.ipynb' for name in foundations]+['agent-research-checks.ipynb'])
if '--sdk' in sys.argv:
    names.extend(['langgraph-interrupts.ipynb', 'langgraph-durable-workflow.ipynb','langgraph-control-flow.ipynb'])
if '--mcp' in sys.argv:
    names.append('mcp-tool-contract.ipynb')
for name in names:
    notebook = json.loads((root / 'notebooks' / name).read_text())
    assert notebook['nbformat'] == 4
    assert len({cell['id'] for cell in notebook['cells']}) == len(notebook['cells'])
    namespace = {'__name__': '__main__'}
    output = io.StringIO()
    previous_cwd = Path.cwd()
    with tempfile.TemporaryDirectory(prefix='suguilin-notebook-') as directory:
        try:
            os.chdir(directory)
            with contextlib.redirect_stdout(output):
                for cell in notebook['cells']:
                    if cell['cell_type'] == 'code':
                        assert cell['outputs'] == [] and cell['execution_count'] is None
                        if (name.startswith('langgraph-') or name=='mcp-tool-contract.ipynb') and 'subprocess.check_call' in ''.join(cell['source']):
                            # Verification uses an already installed isolated environment.
                            os.environ['LANGSMITH_TRACING'] = 'false'
                            os.environ['LANGCHAIN_TRACING_V2'] = 'false'
                            os.environ['LANGGRAPH_STRICT_MSGPACK'] = 'true'
                            continue
                        exec(compile(''.join(cell['source']), name, 'exec'), namespace)
            if name == 'durable-agent.ipynb':
                report = json.loads(Path('recovery_report.json').read_text())
                assert len(report['results']) == 9
                assert report['changed_id']['business_commits'] == 2
                assert report['query_unavailable']['status'] == 'unknown'
                assert report['sqlite'] == {'workers': 20, 'business_commits': 1,
                                             'distinct_receipts': 1, 'payload_conflict': True,
                                             'reopen_commits': 1, 'rollback_commits': 0}
            elif name == 'paired-agent-evaluation.ipynb':
                report = json.loads(Path('evaluation_report.json').read_text())
                assert report['tasks'] == 40 and report['paired_runs'] == 200
                assert report['grouped']['width'] > report['naive']['width']
            elif name == 'langgraph-interrupts.ipynb':
                report = json.loads(Path('langgraph_report.json').read_text())
                assert report['calls'] == {'before_interrupt': 4, 'after_interrupt': 2}
                assert report['same_thread_approved'] and not report['other_thread_approved']
                assert report['new_saver_state'] == {}
            elif name == 'langgraph-durable-workflow.ipynb':
                report = json.loads(Path('langgraph_report.json').read_text())
                assert report['versions'] == {'langgraph': '1.2.14', 'langgraph-checkpoint': '4.2.0', 'langgraph-checkpoint-sqlite': '3.1.1'}
                assert report['after_crash'] == {'next': ['save'], 'business_rows': 1, 'write_attempts': 1, 'before_interrupt': 2}
                assert report['recovered'] == {'next': [], 'business_rows': 1, 'write_attempts': 2, 'before_interrupt': 2}
                assert report['rejected']['business_rows'] == report['rejected']['write_attempts'] == 0
                assert report['thread_isolated'] and report['new_memory_empty'] and report['fork_requires_new_approval']
                assert report['reducer_keys'] == ['a', 'b']
            elif name == 'decision-calibration.ipynb':
                report = json.loads(Path('calibration_report.json').read_text())
                assert report['experiment'] == 'decision-calibration' and report['model_evaluated'] is False
                assert report['baseline']['selective'][1]['accepted'] == 2
                assert report['changed']['selective'][1]['errors'] == 1
                assert abs(namespace['brier'](namespace['labels'], namespace['probabilities']) - 0.1671875) < 1e-12
                accepted = namespace['selective'](namespace['changed'], namespace['probabilities'], 0.9)
                assert accepted['coverage'] == 0.25 and accepted['accepted_error'] == 0.5
            elif name=='langgraph-control-flow.ipynb':
                report=json.loads(Path('langgraph_flow_report.json').read_text())
                assert report['version']=='1.2.14' and report['model_called'] is False
                assert len(report['checks'])==9 and all(report['checks'].values())
                assert namespace['calls']=={'good':1,'bad':2} and namespace['batch']['total']==29
            elif name=='mcp-tool-contract.ipynb':
                report=json.loads(Path('mechanism_report.json').read_text())
                assert report['version']=='2.3.0' and report['protocol']=='2026-07-28'
                assert report['model_called'] is False and all(report['checks'].values())
                assert [r['independent_process'] for r in namespace['results']]==[False,True]
            elif name.removesuffix('.ipynb') in foundations or name=='agent-research-checks.ipynb':
                report=json.loads(Path('mechanism_report.json').read_text())
                assert report['scope']=='stdlib fixtures; no model/service' and all(report['checks'].values())
                assert report['experiment']==('agent-research-checks' if name=='agent-research-checks.ipynb' else 'lesson-'+name.removesuffix('.ipynb'))
        finally:
            os.chdir(previous_cwd)
    print(f'{name}: all cells and output invariants passed')

# Page and notebook contracts cannot drift: run the exact shipped reading snippets.
lesson_data=json.loads((root/'content/lessons.json').read_text())['lessons']
for name in foundations:
    lesson=next(l for l in lesson_data if l['id']=='lesson-'+name)
    blocks=re.findall(r'```python\n(.*?)\n```',lesson['content'],re.S)
    assert len(blocks)==1
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(blocks[0],lesson['id'],'exec'),{})
print('Six foundation reading snippets: exact page code and negative paths passed')

# Other readable Python blocks are runnable too; architecture pseudocode is
# visibly labelled in the page and intentionally excluded from execution.
other_count=0
for item in lesson_data+json.loads((root/'content/topic-readings.json').read_text())['readings']:
    if item['id'] in {'lesson-'+n for n in foundations} or item['id']=='digest-langgraph': continue
    if item['id']=='lesson-harness' and '--sdk' not in sys.argv: continue
    snippets=re.findall(r'(?:```|~~~)python\n(.*?)\n(?:```|~~~)',item['content'],re.S)
    namespace={}
    with contextlib.redirect_stdout(io.StringIO()):
        for snippet in snippets:
            exec(compile(snippet,item['id'],'exec'),namespace)
            other_count+=1
    if item['id']=='lesson-long-term-memory':
        assert namespace['retrieve']('unseen','2026-10-13') is None
    if item['id']=='digest-mcp':
        try: namespace['read_order']({'order_id':'o1'},'bob',{'o1':'alice'})
        except PermissionError: pass
        else: raise AssertionError('MCP application snippet leaked across users')
print(f'{other_count} other exact reading snippets passed; labelled pseudocode excluded')

if '--sdk' in sys.argv:
    # Execute the exact Python snippets shown in the reading page, including imports.
    reading = next(r for r in json.loads((root / 'content/topic-readings.json').read_text())['readings'] if r['id'] == 'digest-langgraph')
    snippets = re.findall(r'~~~python\n(.*?)\n~~~', reading['content'], re.S)
    scope = {}
    for snippet in snippets:
        exec(compile(snippet, 'LangGraph reading snippet', 'exec'), scope)
    assert scope['merge_evidence']({'a': 'same'}, {'a': 'same'}) == {'a': 'same'}
    from typing import TypedDict
    from langgraph.graph import StateGraph, START, END
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.types import Command
    class ApprovalState(TypedDict, total=False):
        draft: str
        draft_version: str
        approval: dict
        status: str
    graph = StateGraph(ApprovalState).add_node('approve', scope['approve']).add_edge(START, 'approve').add_edge('approve', END).compile(checkpointer=InMemorySaver())
    config = {'configurable': {'thread_id': 'snippet'}}
    assert graph.invoke({'draft': '正文代码检查', 'draft_version': 'v1'}, config)['__interrupt__']
    assert graph.invoke(Command(resume={'approved': True, 'draft_version': 'v1'}), config)['status'] == 'approved'
    print('LangGraph reading snippets: imports, reducer and real interrupt/resume passed')
