from setuptools import setup

setup(
    name='orch',
    version='0.1',
    py_modules=['orchestrator', 'setup_aws_cli', 'properties'],
    install_requires=[
        'Click',
        'boto3',
        'pyyaml'
    ],
    entry_points='''
        [console_scripts]
        orch=orchestrator.orchestrator:main
    ''',
)
