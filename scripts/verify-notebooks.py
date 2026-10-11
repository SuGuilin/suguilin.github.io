"""Execute the shipped notebook cells in an isolated temporary directory."""
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile

root = Path(__file__).resolve().parent.parent
for name in ('durable-agent.ipynb', 'paired-agent-evaluation.ipynb'):
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
                        exec(compile(''.join(cell['source']), name, 'exec'), namespace)
            report_name = 'recovery_report.json' if name == 'durable-agent.ipynb' else 'evaluation_report.json'
            report = json.loads(Path(report_name).read_text())
            if name == 'durable-agent.ipynb':
                assert len(report['results']) == 9
                assert report['changed_id']['business_commits'] == 2
                assert report['query_unavailable']['status'] == 'unknown'
            else:
                assert report['tasks'] == 40 and report['paired_runs'] == 200
                assert report['grouped']['width'] > report['naive']['width']
        finally:
            os.chdir(previous_cwd)
    print(f'{name}: all cells and output invariants passed')
