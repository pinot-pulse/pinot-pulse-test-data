.PHONY: var-%
var-%: ## Require variable
	@test "$($*)" || { echo "Please set variable: $*"; exit 1; }

.PHONY: eks-privatelink
eks-privatelink: var-CLUSTER_NAME var-NAMESPACE var-SVC
	@./vpc_endpoint.sh $(CLUSTER_NAME) $(NAMESPACE) $(SVC)
