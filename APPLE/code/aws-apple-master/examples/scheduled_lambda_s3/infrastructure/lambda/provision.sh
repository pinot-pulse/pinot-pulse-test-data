set -ex
cd terraform
STATEFILE_LOCATION=${STATEFILE_LOCATION:-/lambda.tfstate}
terraform init --backend-config="bucket=${STATEFILE_BUCKET}" --backend-config="key=${STATEFILE_LOCATION}/lambda.tfstate" \
&& terraform apply -auto-approve -input=false