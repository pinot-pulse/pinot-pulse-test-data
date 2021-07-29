set -ex
cd terraform
terraform init --backend-config="bucket=${STATEFILE_BUCKET}" --backend-config="key=${STATEFILE_LOCATION}/event.tfstate" \
&& terraform destroy -auto-approve -input=false
