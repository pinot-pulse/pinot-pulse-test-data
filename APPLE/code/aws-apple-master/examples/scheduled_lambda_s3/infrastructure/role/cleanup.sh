set -ex
cd terraform
STATEFILE_LOCATION=${STATEFILE_LOCATION:-/role.tfstate}
terraform init --backend-config="bucket=${STATEFILE_BUCKET}" --backend-config="key=${STATEFILE_LOCATION}/role.tfstate" \
&& terraform destroy -auto-approve -input=false