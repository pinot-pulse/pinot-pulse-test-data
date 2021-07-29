import click
import yaml
import os
import json
from .setup_aws_cli import setup_cli


def get_env_vars(config):
    props = {}
    for key, val in config.items():
        key = key.upper()
        if type(val).__name__ == 'str':
            props[key] = val
            props[key.upper()] = val
            props[f"TF_VAR_{key.upper()}"] = val

        else:
            props[key] = json.dumps(val)
            props[key.upper()] = props[key]
            props[f"TF_VAR_{key.upper()}"] = props[key]

    return props


def set_env(vars):
    for key, val in vars.items():
        os.environ[key] = val


def restore_env(vars):
    for key, _ in vars.items():
        del os.environ[key]


def get_params(file, env):
    with open(get_path(file)) as file:
        config = yaml.load(file, Loader=yaml.FullLoader)
        print(f"CONFIG IS : {env} " + str(config[env]))

        props = config[env]
        return get_env_vars(props)


def get_path(file):
    # return file
    abs = os.path.abspath(file)
    # basename = os.path.basename(os.path.splitext(file)[0])
    return abs


@click.command()
@click.option("--file", default="envs.yaml")
@click.option("--secrets-file", default="secrets.properties")
@click.argument('action', type=click.Choice(["provision", "update", "cleanup"]))
@click.option("--infrastructure-dir", default="./infrastructure")
@click.argument("env", default="")
def main(action, infrastructure_dir, env, file, secrets_file):
    params = get_params(file, env)
    print(params)
    os.environ["AWS_REGION"] = params["REGION"]
    setup_cli(secrets_file, account=params["ACCOUNT"], region=params["REGION"], role=params["ROLE"])
    set_env(params)
    os.chdir(infrastructure_dir)
    status = os.system(f"./{action}.sh")
    set_env(params)
    if status != 0:
        raise RuntimeError(1)


if __name__ == '__main__':
    main()
