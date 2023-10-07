import uuid from "node-uuid";

const generateID = () => uuid.v4().replace(/-/g, "");

export default generateID;
