class Properties:
    data = {}

    def __init__(self, file):
        with open(file) as f:
            for line in f.readlines():
                prop = line.split("=")
                self.data[prop[0].strip()] = prop[1].strip()

    def get(self, key):
        return self.data[key]

    def dict(self):
        return self.data