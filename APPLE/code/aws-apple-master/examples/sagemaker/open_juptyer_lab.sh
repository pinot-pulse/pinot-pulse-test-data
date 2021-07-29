#!/bin/bash

source vars.sh

REGION=$(aws configure get region)
open "https://$REGION.console.aws.amazon.com/sagemaker/home?region=$REGION#/notebook-instances/openNotebook/$SAGEMAKER_STACK_NAME?view=lab"
