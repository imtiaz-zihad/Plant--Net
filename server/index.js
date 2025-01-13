require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const port = process.env.PORT || 5000;
const app = express();
// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6gil.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mq0mae1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("plantNet");
    const usersCollection = db.collection("users");
    const plantsCollection = db.collection("plants");
    const ordersCollection = db.collection("orders");

    const verifyAdmin = async (req, res, next) => {
      // console.log('Data from verify token-->',req.user);
      const email = req.user?.email;
      const query = { email };
      const result = await usersCollection.findOne(query);

      if (!result || result?.role !== "admin")
        return res.status(403).send({ message: "forbidden access" });

      next();
    };
    const verifySeller = async (req, res, next) => {
      // console.log('Data from verify token-->',req.user);
      const email = req.user?.email;
      const query = { email };
      const result = await usersCollection.findOne(query);

      if (!result || result?.role !== "seller")
        return res.status(403).send({ message: "forbidden access" });

      next();
    };

    //Save or update user in db
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = req.body;
      // check if user exists in db
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await usersCollection.insertOne({
        ...user,
        role: "customer",
        timestamp: Date.now(),
      });
      res.send(result);
    });

    // manager user status
    app.patch("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user?.status === "Requested")
        return res
          .status(400)
          .send("You have already requested, wait for some time.");

      const updateDoc = {
        $set: {
          status: "Requested",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      console.log(result);
      res.send(result);
    });

    //get all user data
    app.get("/all-users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: { $ne: email } };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    //---------------------------My Inventory Section for seller ---------------->>
    app.get("/plants/seller", verifyToken, verifySeller, async (req, res) => {
      const email = req.user.email;
      const result = await plantsCollection
        .find({ "seller.email": email })
        .toArray();
      res.send(result);
    });

    //delete a plant from db by seller
    app.delete("/plants/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      
      const result = await plantsCollection.deleteOne(query);
      res.send(result);
    });


    //get all order for specific seller
    app.get("/seller-orders/:email", verifyToken, verifySeller,async (req, res) => {
      const email = req.params.email;
      const result = await ordersCollection
        .aggregate([
          {
            $match: { seller: email }, //Match Specific customers data only by email
          },
          {
            $addFields: {
              plantId: { $toObjectId: "$plantId" }, //Convert plant id string field to objectId field
            },
          },
          {
            $lookup: {
              //go to different collection and look for data
              from: "plants", //collection name
              localField: "plantId", //local data that you want to watch
              foreignField: "_id", // foreign field name of that same data
              as: "plants", // return the data as plants array(array naming)
            },
          },
          {
            $unwind: "$plants", //unwind lookup results ,return without array
          },
          {
            $addFields: {
              //add these field in order object
              name: "$plants.name"
            },
          },
          {
            $project: {
              //remove plants objects from order objects
              plants: 0,
            },
          },
        ])
        .toArray();
      res.send(result);
    });


    //<<----------------------------------------------------------------------->>

    //update user role  status

    app.patch(
      "/user/role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const { role, status } = req.body;
        const filter = { email };
        const updateDoc = {
          $set: { role, status: "Verified" },
        };

        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    //get user role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    //Save a plant data
    app.post("/plants", verifyToken, verifySeller, async (req, res) => {
      const plant = req.body;
      const result = await plantsCollection.insertOne(plant);
      res.send(result);
    });

    ///Get all Plants
    app.get("/plants", async (req, res) => {
      const result = await plantsCollection.find().limit(20).toArray();
      res.send(result);
    });

    //Get a plant by id
    app.get("/plants/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await plantsCollection.findOne(query);
      res.send(result);
    });

    //save order data in db
    app.post("/orders", verifyToken, async (req, res) => {
      const order = req.body;

      console.log(order);

      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    //manage plant quantity
    app.patch("/plants/quantity/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { quantityToUpdate, status } = req.body;
      const query = { _id: new ObjectId(id) };
      let updateDoc = {
        $inc: {
          quantity: -quantityToUpdate,
        },
      };

      if (status === "increase") {
        updateDoc = {
          $inc: {
            quantity: quantityToUpdate,
          },
        };
      }
      const result = await plantsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //Get all orders by customer email
    app.get("/customer-orders/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await ordersCollection
        .aggregate([
          {
            $match: { "customer.email": email }, //Match Specific customers data only by email
          },
          {
            $addFields: {
              plantId: { $toObjectId: "$plantId" }, //Convert plant id string field to objectId field
            },
          },
          {
            $lookup: {
              //go to different collection and look for data
              from: "plants", //collection name
              localField: "plantId", //local data that you want to watch
              foreignField: "_id", // foreign field name of that same data
              as: "plants", // return the data as plants array(array naming)
            },
          },
          {
            $unwind: "$plants", //unwind lookup results ,return without array
          },
          {
            $addFields: {
              //add these field in order object
              name: "$plants.name",
              image: "$plants.image",
              category: "$plants.category",
            },
          },
          {
            $project: {
              //remove plants objects from order objects
              plants: 0,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    //Cancel delete order
    app.delete("/orders/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const order = await ordersCollection.findOne(query);
      if (order.status === "Delivered")
        return res
          .status(409)
          .send("Cannot cancel once the product is delivered ");
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from plantNet Server..");
});

app.listen(port, () => {
  console.log(`plantNet is running on port ${port}`);
});
