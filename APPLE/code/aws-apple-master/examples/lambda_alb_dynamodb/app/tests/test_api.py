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
            'x-forwarded-proto': 'http'
        },
        'body': '',
        'isBase64Encoded': False
    }

    def test_index(self):
        response = lambda_handler(self.example_event, {})
        self.assertEqual(response['statusCode'], 302)

    def test_hello(self):
        self.example_event['path'] = '/hello'
        response = lambda_handler(self.example_event, {})
        self.assertIn('idmsac', response['headers']['Location'])

    def test_goodbye(self):
        self.example_event['path'] = '/goodbye'
        response = lambda_handler(self.example_event, {})
        self.assertIn('idmsac', response['headers']['Location'])


if __name__ == '__main__':
    unittest.main()
