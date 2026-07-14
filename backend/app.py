import os
import sys
import pathlib as Path 
from flask import Flask, render_template

app = Flask(__name__)



BASE_DIR = os.path.dirname(__file__)

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "..", "frontend"),
    static_folder=os.path.join(BASE_DIR, "..", "frontend"),
    static_url_path=""
)

@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
    