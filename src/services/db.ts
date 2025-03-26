import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config({ path: ".env" });

const cloudDB = process.env.CLOUD_DB;
const localDB = process.env.LOCAL_DB;
const connectionMap = new Map();
connectionMap.set("cloudDB", cloudDB);
connectionMap.set("cloud", cloudDB);
connectionMap.set("localDB", localDB);
connectionMap.set("local", localDB);

mongoose.set("strictQuery", false);

class Db {
  /**
   * The MongoDB database class
   *
   * @remarks
   * This class handles the connection to the MongoDB database. This can be the local
   * connection, cloud connection, or a test connection (in-memory database).
   */

  private dbType: string;

  constructor(dbType: "local" | "cloud") {
    this.dbType = dbType;
  }

  private async connectHelper() {
    const connectionURL = connectionMap.get(this.dbType);
    if (!connectionURL) {
      throw new Error("Invalid database type provided");
    }
    await mongoose.connect(connectionURL);
    console.log(
      "Successfully connected to " + this.dbType + " database server!"
    );
  }

  public async connect() {
    await this.connectHelper();
  }

  public async closeDatabase() {
    await mongoose.connection.close();
  }
}

export default Db;
