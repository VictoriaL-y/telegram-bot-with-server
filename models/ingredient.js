const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ingredientSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    cup: {
        type: Number,
        required: true
    }
}, { versionKey: false });

const Ingredient = mongoose.model("Ingredient", ingredientSchema);
module.exports = Ingredient;