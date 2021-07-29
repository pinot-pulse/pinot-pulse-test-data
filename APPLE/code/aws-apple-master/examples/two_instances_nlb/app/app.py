import requests
from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def hello():
    try:
        metadata_service = "http://169.254.169.254/latest/meta-data/"
        r = requests.get(metadata_service, timeout=0.1)
        instance_az = requests.get("%s/placement/availability-zone" % (metadata_service))
        instance_ip = requests.get("%s/local-ipv4" % (metadata_service))
        instance_id = requests.get("%s/instance-id" % (metadata_service))
        return render_template('example.html',
                               instance_az=str(instance_az.text),
                               instance_ip=str(instance_ip.text),
                               instance_id=str(instance_id.text))
    except requests.exceptions.ConnectTimeout:
        return render_template('example.html')

@app.route("/health")
def health():
	return "ok"

if __name__ == "__main__":
    app.run()
