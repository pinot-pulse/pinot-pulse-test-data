#!/bin/bash

set -e

source vars.sh
source vars.defaults
source lib/eks.sh

set -x

eks_cleanup_vpces
eks_cleanup_stacks
eks_cleanup_nlbs
eks_cleanup_ebs
