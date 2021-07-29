import unittest

from example.wsgi import lambda_handler


class ApiTest(unittest.TestCase):
    """Unit tests for Lambda Example API."""

    example_arn = 'arn:aws:elasticloadbalancing:us-east-1:'
    example_arn += 'XXXXXXXXXXX:targetgroup/sample/6d0ecf831eec9f09'

    example_event = {
        'requestContext': {
            'elb': {
                'targetGroupArn': example_arn
            }
        },
        'httpMethod': 'GET',
        'path': '/',
        'queryStringParameters': {},
        'headers': {
            'host': 'lambda-YYYYYYYY.elb.amazonaws.com',
            'accept-encoding': 'gzip',
            'accept-language': 'en-US,en;q=0.5',
            'x-forwarded-proto': 'http',
            'content-type': 'application/json'
        },
        'body': '',
        'isBase64Encoded': False
    }

    example_body = '''
    {
        "firstName": "Jane",
        "lastName": "Doe",
        "emailAddress": "jane_doe@apple.com"
    }
    '''

    def test_not_found(self):
        self.example_event['path'] = '/null'
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 404)

    def test_not_allowed(self):
        self.example_event['path'] = '/api/user'
        self.example_event['httpMethod'] = 'PATCH'
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 405)

    def test_bad_request(self):
        self.example_event['path'] = '/api/user/123456789'
        self.example_event['httpMethod'] = 'POST'
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 400)

    def test_create_user(self):
        self.example_event['path'] = '/api/user/123456789'
        self.example_event['httpMethod'] = 'POST'
        self.example_event['body'] = self.example_body
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 200)

    def test_get_user(self):
        self.example_event['path'] = '/api/user/123456789'
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 200)

    def test_get_users(self):
        self.example_event['path'] = '/api/user'
        self.example_event['httpMethod'] = 'GET'
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 200)

    def test_delete_user(self):
        self.example_event['path'] = '/api/user/123456789'
        self.example_event['httpMethod'] = 'DELETE'
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 200)


if __name__ == '__main__':
    unittest.main()
