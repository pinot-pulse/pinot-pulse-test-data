import json
import boto3

ecr = boto3.client('ecr')

def get_repo_list():
    repo_list = []
    response = ecr.describe_repositories()
    for repositories in response['repositories']:
        if repositories['imageScanningConfiguration']['scanOnPush'] == False:
            repo_list.append(repositories['repositoryName'])
    return repo_list

def set_scan_config(repo_list):
    for reponame in repo_list:
        response = ecr.put_image_scanning_configuration(
            repositoryName = reponame,
            imageScanningConfiguration = {
                'scanOnPush' : True
            }
        )
        print ("ScanOnPush has been enabled for Repository: ", reponame)

def lambda_handler(event, context):
    repo_list = get_repo_list()
    if len(repo_list) !=0:
        set_scan_config(repo_list)
