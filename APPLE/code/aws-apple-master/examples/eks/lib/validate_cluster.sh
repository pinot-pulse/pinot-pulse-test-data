#!/usr/bin/env bash
# Copyright 2014 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Modified https://github.com/kubernetes/kubernetes/blob/master/cluster/validate-cluster.sh to fit our use case.

# Validates that the cluster is healthy.
# Error codes are:
# 0 - success
# 1 - fatal (cluster is unlikely to work)
# 2 - non-fatal (encountered some errors, but cluster should be working correctly)

set -o errexit
set -o nounset
set -o pipefail

# Run kubectl and retry upon failure.
function kubectl_retry() {
  tries=3
  while ! "kubectl" "$@"; do
    tries=$((tries-1))
    if [[ ${tries} -le 0 ]]; then
      echo "('kubectl $@' failed, giving up)" >&2
      return 1
    fi
    echo "(kubectl failed, will retry ${tries} times)" >&2
    sleep 1
  done
}

ALLOWED_NOTREADY_NODES="${ALLOWED_NOTREADY_NODES:-0}"
CLUSTER_READY_ADDITIONAL_TIME_SECONDS="${CLUSTER_READY_ADDITIONAL_TIME_SECONDS:-30}"
EXPECTED_NUM_NODES="${NUM_NODES}"
REQUIRED_NUM_NODES=$((EXPECTED_NUM_NODES - ALLOWED_NOTREADY_NODES))
# Make several attempts to deal with slow cluster birth.
return_value=0
attempt=0
# Set the timeout to ~25minutes (100 x 15 second) to avoid timeouts for 1000-node clusters.
PAUSE_BETWEEN_ITERATIONS_SECONDS=15
MAX_ATTEMPTS=100
ADDITIONAL_ITERATIONS=$(((CLUSTER_READY_ADDITIONAL_TIME_SECONDS + PAUSE_BETWEEN_ITERATIONS_SECONDS - 1)/PAUSE_BETWEEN_ITERATIONS_SECONDS))
while true; do
  # Pause between iterations of this large outer loop.
  if [[ ${attempt} -gt 0 ]]; then
    sleep 15
  fi
  attempt=$((attempt+1))

  # The "kubectl get nodes -o template" exports node information.
  #
  # Echo the output and gather 2 counts:
  #  - Total number of nodes.
  #  - Number of "ready" nodes.
  #
  # Suppress errors from kubectl output because during cluster bootstrapping
  # for clusters where the master node is registered, the apiserver will become
  # available and then get restarted as the kubelet configures the docker bridge.
  #
  # We are assigning the result of kubectl_retry get nodes operation to the res
  # variable in that way, to prevent stopping the whole script on an error.
  #
  # Bash command substitution $(kubectl_...) removes all trailing whitespaces
  # which are important for line counting.
  # Use trick from https://unix.stackexchange.com/a/383411 to avoid
  # newline truncation.
  node=$(kubectl_retry get nodes --no-headers; ret=$?; echo .; exit "$ret") && res="$?" || res="$?"
  node="${node%.}"
  if [ "${res}" -ne "0" ]; then
    if [[ "${attempt}" -gt "${last_run:-$MAX_ATTEMPTS}" ]]; then
      echo -e "Failed to get nodes."
      exit 1
    else
      continue
    fi
  fi
  found=$(echo -n "${node}" | wc -l)
  # Use grep || true so that empty result doesn't return nonzero exit code.
  ready=$(echo -n "${node}" | grep -c -v "NotReady" || true)

  if (( "${found}" == "${EXPECTED_NUM_NODES}" )) && (( "${ready}" == "${EXPECTED_NUM_NODES}")); then
    break
  elif (( "${found}" > "${EXPECTED_NUM_NODES}" )); then
    if [[ "${KUBE_USE_EXISTING_MASTER:-}" != "true" ]]; then
      echo -e "Found ${found} nodes, but expected ${EXPECTED_NUM_NODES}. Your cluster may not behave correctly."
    fi
    break
  elif (( "${ready}" > "${EXPECTED_NUM_NODES}")); then
    echo -e "Found ${ready} ready nodes, but expected ${EXPECTED_NUM_NODES}. Your cluster may not behave correctly."
    break
  else
    if [[ "${REQUIRED_NUM_NODES}" -le "${ready}" ]]; then
      echo -e "Found ${REQUIRED_NUM_NODES} Nodes, allowing additional ${ADDITIONAL_ITERATIONS} iterations for other Nodes to join."
      last_run="${last_run:-$((attempt + ADDITIONAL_ITERATIONS - 1))}"
    fi
    if [[ "${attempt}" -gt "${last_run:-$MAX_ATTEMPTS}" ]]; then
      echo -e "Detected ${ready} ready nodes, found ${found} nodes out of expected ${EXPECTED_NUM_NODES}. Your cluster may not be fully functional."
      kubectl_retry get nodes
      if [[ "${REQUIRED_NUM_NODES}" -gt "${ready}" ]]; then
        exit 1
      else
        return_value=2
        break
      fi
    else
      echo -e "Waiting for ${EXPECTED_NUM_NODES} ready nodes. ${ready} ready nodes, ${found} registered. Retrying."
    fi
  fi
done
echo "Found ${found} node(s)."
kubectl_retry get nodes

attempt=0
while true; do
  # The "kubectl componentstatuses -o template" exports components health information.
  #
  # Echo the output and gather 2 counts:
  #  - Total number of componentstatuses.
  #  - Number of "healthy" components.
  cs_status=$(kubectl_retry get componentstatuses -o template --template='{{range .items}}{{with index .conditions 0}}{{.type}}:{{.status}}{{end}}{{"\n"}}{{end}}') || true
  componentstatuses=$(echo "${cs_status}" | grep -c 'Healthy:') || true
  healthy=$(echo "${cs_status}" | grep -c 'Healthy:True') || true

  if ((componentstatuses > healthy)) || ((componentstatuses == 0)); then
    if ((attempt < 5)); then
      echo -e "Cluster not working yet."
      attempt=$((attempt+1))
      sleep 30
    else
      echo -e " Validate output:"
      kubectl_retry get cs
      echo -e "Validation returned one or more failed components. Cluster is probably broken."
      exit 1
    fi
  else
    break
  fi
done

echo "Validate output:"
kubectl_retry get cs || true
if [ "${return_value}" == "0" ]; then
  echo -e "Cluster validation succeeded"
else
  echo -e "Cluster validation encountered some problems, but cluster should be in working order"
fi

exit "${return_value}"
