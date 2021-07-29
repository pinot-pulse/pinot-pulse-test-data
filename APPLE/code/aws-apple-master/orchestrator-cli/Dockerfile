from docker.apple.com/cloudtech/awscli:latest

RUN pip3 install boto3 click pyyaml

COPY . /orchestrator-cli
RUN pip3 install -e /orchestrator-cli
