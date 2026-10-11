"""Execute the shipped notebook cells in an isolated temporary directory."""
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import sys

root = Path(__file__).resolve().parent.parent
names = ['durable-agent.ipynb', 'paired-agent-evaluation.ipynb', 'agent-mechanism-checks.ipynb', 'decision-calibration.ipynb']
if '--sdk' in sys.argv:
    names.append('langgraph-interrupts.ipynb')
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
                        if name == 'langgraph-interrupts.ipynb' and 'subprocess.check_call' in ''.join(cell['source']):
                            # Verification uses an already installed isolated environment.
                            os.environ['LANGSMITH_TRACING'] = 'false'
                            os.environ['LANGCHAIN_TRACING_V2'] = 'false'
                            continue
                        exec(compile(''.join(cell['source']), name, 'exec'), namespace)
            if name == 'durable-agent.ipynb':
                report = json.loads(Path('recovery_report.json').read_text())
                assert len(report['results']) == 9
                assert report['changed_id']['business_commits'] == 2
                assert report['query_unavailable']['status'] == 'unknown'
            elif name == 'paired-agent-evaluation.ipynb':
                report = json.loads(Path('evaluation_report.json').read_text())
                assert report['tasks'] == 40 and report['paired_runs'] == 200
                assert report['grouped']['width'] > report['naive']['width']
            elif name == 'langgraph-interrupts.ipynb':
                report = json.loads(Path('langgraph_report.json').read_text())
                assert report['calls'] == {'before_interrupt': 4, 'after_interrupt': 2}
                assert report['same_thread_approved'] and not report['other_thread_approved']
                assert report['new_saver_state'] == {}
            elif name == 'decision-calibration.ipynb':
                assert abs(namespace['brier'](namespace['labels'], namespace['probabilities']) - 0.1671875) < 1e-12
                accepted = namespace['selective'](namespace['changed'], namespace['probabilities'], 0.9)
                assert accepted['coverage'] == 0.25 and accepted['accepted_error'] == 0.5
        finally:
            os.chdir(previous_cwd)
    print(f'{name}: all cells and output invariants passed')
