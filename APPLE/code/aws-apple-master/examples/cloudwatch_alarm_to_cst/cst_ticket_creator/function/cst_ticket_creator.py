import os
import json
import logging
import urllib3
from timeit import default_timer as timer

# Test Event example
# {
#   "Records": [
#     {
#       "EventSource": "aws:sns",
#       "EventVersion": "1.0",
#       "EventSubscriptionArn": "",
#       "Sns": {
#         "Type": "Notification",
#         "MessageId": "ae0cb6ea-40d1-5fe3-b41c-e1480076ea34",
#         "TopicArn": "",
#         "Subject": "test subject1",
#         "Message": "test body1",
#         "Timestamp": "2020-08-03T16:42:15.412Z",
#         "SignatureVersion": "1",
#         "Signature": "",
#         "SigningCertUrl": "",
#         "UnsubscribeUrl": "",
#         "MessageAttributes": {}
#       }
#     }
#   ]
# }
logger = logging.getLogger()
if len(logging.getLogger().handlers) > 0:
    # The Lambda environment pre-configures a handler logging to stderr. If a handler is already configured,
    # `.basicConfig` does not execute. Thus we set the level directly.
    logger.setLevel(logging.INFO)
else:
    logging.basicConfig(level=logging.INFO)


def get_a3_token(appId):
    if os.environ['VERIFY_SSL'] == '1':
        http = urllib3.PoolManager(timeout=urllib3.Timeout(connect=5.0, read=5.0), retries=2, cert_reqs='CERT_REQUIRED', ca_certs=os.environ['IDMS_CERT'])
    else:
        http = urllib3.PoolManager(timeout=urllib3.Timeout(connect=5.0, read=5.0), retries=2, cert_reqs='CERT_NONE', assert_hostname=False)
    start = timer()
    appPass = os.environ['APP_PASS']
    dsTokenUrl = os.environ['DS_TOKEN_URL']
    tokenRequest = {
        "appId": appId,
        "appPassword": appPass,
        "otherApp": "150899",
        "context": "#GrandPrix#",
        "oneTimeToken": False,
        "contextVersion": 3,
    }
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json', 'cache-control': 'no-cache'}
    logger.info("Getting token request to url:" + dsTokenUrl + ", requestPayload:" + json.dumps(tokenRequest) + ", headers: " + str(headers))
    tokenResponse = http.request('POST',
                                 dsTokenUrl,
                                 body=json.dumps(tokenRequest),
                                 headers=headers
                                 )
    logger.info("token:" + tokenResponse.data.decode('utf-8'))
    end = timer()
    logger.info("Time getting token:" + str(end - start))
    return json.loads(tokenResponse.data.decode('utf-8'))['token']


def create_incident_record(event):
    if os.environ['VERIFY_SSL'] == '1':
        http = urllib3.PoolManager(timeout=urllib3.Timeout(connect=5.0, read=10.0), retries=3, cert_reqs='CERT_REQUIRED', ca_certs=os.environ['CST_CERT'])
    else:
        http = urllib3.PoolManager(timeout=urllib3.Timeout(connect=5.0, read=10.0), retries=3, cert_reqs='CERT_NONE', assert_hostname=False)
    start = timer()
    appId = os.environ['APP_ID']
    cstUrl = os.environ['CST_URL']
    token = get_a3_token(appId)
    createIncidentRequest = {
        "module": "incident",
        "callingApp": appId,
        "callerId": os.environ['CALLER_ID'],
        "businessService": "IS&T",
        "category": "Alert & Monitoring",
        "configuration": os.environ['CONFIGURATION'],
        "title": event['Records'][0]['Sns']['Subject'],
        "impact": "3 - Low",
        "description": event['Records'][0]['Sns']['Message'],
        "environment": os.environ['ENVIRONMENT'],
        "urgency": "3 - Low",
        "assignedPersonId": os.environ['ASSIGNED_PERSON_ID'],
    }
    if os.environ['ASSIGNED_PERSON_ID']:
        createIncidentRequest["assignmentGroupId"] = os.environ['ASSIGNED_PERSON_ID']
    headers = {
        'Content-Type': 'application/json',
        'HTTP_HEADER_KENTAURUS_CONSUMER_ID': appId,
        'HTTP_HEADER_KENTAURUS_AUTH_TOKEN': token,
        'HTTP_HEADER_KENTAURUS_TOKEN_TYPE': 'APP'
    }

    logger.info("Creating incident url:" + cstUrl + ", requestPayload:" + json.dumps(createIncidentRequest) + ", headers: " + str(headers))
    incidentResponse = http.request('POST',
                                    cstUrl,
                                    body=json.dumps(createIncidentRequest),
                                    headers=headers
                                    )
    response = json.loads(incidentResponse.data)['result']
    if not (200 < response['status']['httpStatusCode'] < 300):
        logger.error("Error creating incident")
        raise Exception(str(response))
    logger.info("cst response:" + str(incidentResponse.data))
    end = timer()
    logger.info("Time creating incident:" + str(end - start))


def lambda_handler(event, context):
    logger.info("cst_ticket_creator executed with event:" + str(event))
    create_incident_record(event)

    return {
        "statusCode": 200,
        "body": json.dumps("Operation completed successfully")
    }
