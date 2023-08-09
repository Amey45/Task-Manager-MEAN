const express = require("express");
const colors = require("colors");
const { List } = require("./db/models/Listmodels");
const { task } = require("./db/models/Taskmodel");
const { User } = require("./db/models/userModel");
const bodyParser = require("body-parser");
const { mongoose } = require("./db/mongoose.js");
const app = express();
const jwt = require("jsonwebtoken");

//middlewares
//for parsing the request and json body
app.use(bodyParser.json());

//to handle the cross origin
//CORS Headers midddleware from enable-cors.org
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, HEAD, OPTIONS, PUT"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id"
  );

  res.header(
    "Access-Control-EXPOSE-HEADERS",
    "x-access-token , x-refresh-token"
  );

  next();
});

//check whether request has valid JWT token
let authenticate = (req, res, next) => {
  let token = req.header("x-access-token");

  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
    if (err) {
      res.status(401).send(err);
    } else {
      req.user_id = decoded._id;
      next();
    }
  });
};

//verify refreshtoken middleware
let verifySession = (req, res, next) => {
  let refreshToken = req.header("x-refresh-token");

  let _id = req.header("_id");

  User.findByIdAndToken(_id, refreshToken)
    .then((user) => {
      if (!user) {
        return Promise.reject({
          error:
            "user not found , make sure that Id and refreshToken are valid",
        });
      }

      req.user_id = user._id;
      req.userObject = user;
      req.refreshToken = refreshToken;

      let isSessionValid = false;

      user.sessions.forEach((session) => {
        if (session.token === refreshToken) {
          if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
            isSessionValid = true;
          }
        }
      });

      if (isSessionValid) {
        next();
      } else {
        return Promise.reject({
          error: "refresh token has expired",
        });
      }
    })
    .catch((e) => {
      res.status(401).send(e);
    });
};

app.get("/", (req, res) => {
  res.send("Welcome to the Task Manager");
});

//lists
app.get("/lists", authenticate, (req, res) => {
  List.find({
    _userId: req.user_id,
  })
    .then((lists) => {
      res.send(lists);
    })
    .catch((err) => {
      res.send(err);
    });
});

app.post("/lists", authenticate, (req, res) => {
  let title = req.body.title;

  let newList = new List({ title, _userId: req.user_id });

  newList.save().then((listDoc) => {
    res.send(listDoc);
  });
});

app.patch("/lists/:id", authenticate, (req, res) => {
  List.findOneAndUpdate(
    { _id: req.params.id, _userId: req.user_id },
    { $set: req.body }
  ).then(() => {
    res.send({ message: "List is updated successfully" });
  });
});

app.delete("/lists/:id", authenticate, (req, res) => {
  List.findOneAndRemove({ _id: req.params.id, _userId: req.user_id }).then(
    (removedListDoc) => {
      res.send(removedListDoc);

      //delete tasks from that list too

      deleteTasksFromList(removedListDoc._id);
    }
  );
});

//tasks

app.get("/lists/:listId/tasks", authenticate, (req, res) => {
  task
    .find({ _listId: req.params.listId })
    .then((tasks) => {
      res.send(tasks);
    })
    .catch((err) => {
      res.send(err);
    });
});

app.post("/lists/:listId/tasks", authenticate, (req, res) => {
  List.findOne({ _id: req.params.listId, _userId: req.user_id })
    .then((list) => {
      if (list) {
        return true;
      }

      return false;
    })
    .then((canCreateTask) => {
      if (canCreateTask) {
        let newTask = new task({
          title: req.body.title,
          _listId: req.params.listId,
        });

        newTask.save().then((newtaskDoc) => {
          res.send(newtaskDoc);
        });
      } else {
        res.sendStatus(404);
      }
    });
});

app.patch("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {
  List.findOne({ _id: req.params.listId, _userId: req.user_id })
    .then((list) => {
      if (list) {
        return true;
      }

      return false;
    })
    .then((canUpdateTask) => {
      if (canUpdateTask) {
        task
          .findOneAndUpdate(
            {
              _id: req.params.taskId,
              _listId: req.params.listId,
            },
            { $set: req.body }
          )
          .then(() => {
            res.send({ message: "Task is updated successfully" });
          });
      } else {
        res.send({message: "Ta sk is not updated successfully"});
      }
    });
});

app.delete("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {
  List.findOne({ _id: req.params.listId, _userId: req.user_id })
    .then((list) => {
      if (list) {
        return true;
      }

      return false;
    })
    .then((canDeleteTask) => {
      if (canDeleteTask) {
        task
          .findOneAndRemove({
            _id: req.params.taskId,
            _listId: req.params.listId,
          })
          .then((removedtaskdoc) => {
            res.send(removedtaskdoc);
          });
      } else {
        res.sendStatus(404);
      }
    });
});

//users

//sign-up
app.post("/users", (req, res) => {
  let body = req.body;
  let newUser = new User(body);

  newUser
    .save()
    .then(() => {
      return newUser.createSession();
    })
    .then((refreshToken) => {
      return newUser.generateAccessAuthToken().then((accessToken) => {
        return { accessToken, refreshToken };
      });
    })
    .then((authTokens) => {
      res
        .header("x-refresh-token", authTokens.refreshToken)
        .header("x-access-token", authTokens.accessToken)
        .send(newUser);
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

/** Login */
app.post("/users/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password)
    .then((user) => {
      return user
        .createSession()
        .then((refreshToken) => {
          return user.generateAccessAuthToken().then((accessToken) => {
            return { accessToken, refreshToken };
          });
        })
        .then((authTokens) => {
          res
            .header("x-refresh-token", authTokens.refreshToken)
            .header("x-access-token", authTokens.accessToken)
            .send(user);
        });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

app.get("/users/me/access-token", verifySession, (req, res) => {
  req.userObject
    .generateAccessAuthToken()
    .then((accessToken) => {
      res.header("x-access-token", accessToken).send({ accessToken });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

let deleteTasksFromList = (_listId) => {
  task.deleteMany({ _listId }).then(() => {
    console.log("Tasks from list " + _listId + " are deleted");
  });
};

app.listen(4000, () => {
  console.log("server is in development mode on port 4000".bgCyan.white);
});
