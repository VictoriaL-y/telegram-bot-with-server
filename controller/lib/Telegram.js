const { axiosInstance } = require("./axios");
const Ingredient = require("../../models/ingredient")

function sendMessage(messageObj, messageText) {
    return axiosInstance.get("sendMessage", {
        chat_id: messageObj.chat.id,
        text: messageText,
    });
}

async function handleMessage(messageObj) {
    const messageText = messageObj.text || "";
    let areThereUnknownIngredients = false;

    if (!messageText) {
        return sendMessage(messageObj, "I can't convert this");
    } else if (messageText.charAt(0) === "/") {
        const command = messageText.substr(1);
        switch (command) {
            case "start":
                // send a welcome message to the user
                return sendMessage(
                    messageObj,
                    "Hi! I'm a bot who can help you to convert ingredients quantity from US measurements to EU"
                );
            case "help":
                // send an instruction message
                return sendMessage(
                    messageObj,
                    "Send me a list of ingredients to convert (tsp, tbsp, cup -> grams). It must be a text in column format.\n\nExample:\n1 cup salted butter softened\n1 cup granulated sugar\n1 cup light brown sugar packed\n2 teaspoons pure vanilla extract\n2 large eggs\n3 cups all-purpose flour\n1 teaspoon baking soda"
                );
            case "all":
                // get all the ingredients from the database
                getAllIngredients(messageObj);
                break;
            case "add":
                // get a message how to add a new ingredient to the conversion table
                return sendMessage(messageObj,
                    "Which ingredient do you want to add to my table? How many grams of it are in a US cup? Please write it in the following format:\n\n/add name weight");

            case "add " + messageText.substr(5):
                // add a new ingredient to the conversion table
                addIngredient(messageObj, messageText);
                break;

            case "delete":
                // get a message how to delete an existing ingredient from the conversion table
                return sendMessage(messageObj,
                    "Which ingredient do you want to delete from my table? Please write it in the following format:\n\n/delete name");

            case "delete" + messageText.substr(7):
                // delete an existing ingredient from the conversion table
                deleteIngredient(messageObj, messageText);
                break;

            case "edit":
                // get a message how to delete an existing ingredient from the conversion table
                return sendMessage(messageObj,
                    "For which ingredient do you want to adjust the weight? Please write it in the following format:\n\n/edit name weight");

            case "edit" + messageText.substr(5):
                // add a new ingredient to the conversion table
                updateIngredient(messageObj, messageText);
                break;
            default:
                return sendMessage(messageObj,
                    "Hey, I don't know this command");
        }
    } else {
        //convert a recipe and send it back to the user
        const recipe = await getConvertedRecipe(messageText);
        console.log("I got the converted recipe");

        if (areThereUnknownIngredients) {
            console.log("An unknown ingredient")
            return sendMessage(messageObj, "I could't find some ingredinets in my table, you should add them and try converting again.\n\n" + recipe);
        }
        return sendMessage(messageObj, recipe);
    }
}

function getAllIngredients(messageObj) {
    Ingredient.find()
        .then((result) => {
            let ingredientsList = ""
            console.log(result.length + " is length and the array of all the ingredients is: " + result);
            for (let ingredient of result) {
                if (result.indexOf(ingredient) === result.length - 1) {
                    ingredientsList += ingredient.name;
                } else {
                    ingredientsList += ingredient.name + "\n";
                }
            }
            return sendMessage(
                messageObj, ingredientsList);
        })
        .catch((err) => {
            console.log(err);
        });
}

function addIngredient(messageObj, messageText) {

    const ingredientArr = messageText.split(/\s/);
    const ingredientWeigth = ingredientArr[ingredientArr.length - 1];
    const ingredientName = messageText.replace("/add ", "").replace(" " + ingredientWeigth, "");

    if (isNaN(ingredientWeigth)) {
        return sendMessage(messageObj,
            "Please try again, the weight is incorrect");
    }
    Ingredient.findOne({ name: ingredientName })
        .then((result) => {
            if (result) {
                return sendMessage(
                    messageObj, "This ingredient is already in the table.");
            } else {
                // save a new ingredient to the table
                const ingredient = new Ingredient({
                    name: ingredientName,
                    cup: parseInt(ingredientWeigth)
                });

                ingredient.save()
                    .then(() => {
                        return sendMessage(messageObj, "The ingredient " + ingredientName + " was successfully added!");
                    })
                    .catch((err) => {
                        console.log(err);
                    })
            }
        });
}

function deleteIngredient(messageObj, messageText) {
    const ingredientName = messageText.substr(8);

    Ingredient.findOneAndDelete({ name: ingredientName })
        .then((result) => {
            if (result) {
                return sendMessage(messageObj, "The ingredient " + ingredientName + " was successfully deleted!");
            } else {
                return sendMessage(
                    messageObj, "This ingredient " + ingredientName + " doesn't exist in the table");
            }
        })
        .catch((err) => {
            console.log(err);
        })
}

function updateIngredient(messageObj, messageText) {
    const ingredientArr = messageText.split(/\s/);
    const ingredientWeigth = ingredientArr[ingredientArr.length - 1];
    const ingredientName = messageText.replace("/edit ", "").replace(" " + ingredientWeigth, "");

    if (isNaN(ingredientWeigth)) {
        return sendMessage(messageObj,
            "Please try again, the weight is incorrect");
    } else {
        Ingredient.findOneAndUpdate({ name: ingredientName }, { $set: { cup: parseInt(ingredientWeigth) } })
            .then((result) => {
                if (!result) {
                    return sendMessage(
                        messageObj, "This ingredient doesn't exist in the table");
                } else {
                    return sendMessage(messageObj, "The ingredient " + ingredientName + " now is " + ingredientWeigth + "gr for a cup!");
                }
            })
            .catch((err) => {
                console.log(err);
            })
    }
}

async function getConvertedRecipe(messageText) {
    console.log("I'm ready to convert a recipe");
    let recipeInGramsArr = [];
    let newWeight;
    let oldWeight;
    const recipeArr = messageText.toLowerCase()
        .replaceAll("cups", "cup")
        .replaceAll("tablespoons", "tbsp")
        .replaceAll("tablespoon", "tbsp")
        .replaceAll("teaspoons", "tsp")
        .replaceAll("teaspoon", "tsp")
        .replaceAll("⅔", "2/3")
        .replaceAll("¾", "3/4")
        .replaceAll("½", "1/2")
        .replaceAll("⅓", "1/3")
        .replaceAll("¼", "1/4")
        .split("\n") // get like [ '2 1/2 cup flour', '3 tbsp sugar' ]
    console.log(recipeArr)

    for (let ingredient of recipeArr) {
        let ingredientArr = ingredient.replace(/[&#,+()$~%.'":*?<>{}]/g, "").split(/\s/); // get like [ '2', '1/2', 'cup', 'flour' ]
        let amount = ingredientArr[0];
        let ingredientArrWithSigns = ingredient.split(/\s/);
        console.log(ingredient + " is a line from the list")

        const [measurementContainer, indexOfContainer, factor] = getMeasurementContainer(ingredientArr);
        if (indexOfContainer === -1) {
            recipeInGramsArr.push(ingredientArrWithSigns.join(" "));
            continue;
        }
        const nameOfIngredient = await getProductName(ingredientArr, indexOfContainer);
        if (nameOfIngredient === undefined) {
            areThereUnknownIngredients = true;
            recipeInGramsArr.push(ingredientArrWithSigns.join(" "));
            continue;
        }
        await Ingredient.findOne({ name: nameOfIngredient })
            .then((result) => {
                console.log(result.cup + " is a weight for a cup")
                if (indexOfContainer === 1) {
                    oldWeight = amount;
                    if (ingredientArr[0].split('/').length === 1) { // if we have a whole number of cups/tbsp/tsp
                        amount = parseInt(amount);
                    } else {
                        amount = parseInt(amount[0]) / parseInt(amount[2]);
                    }
                } else if (indexOfContainer === 2) {
                    let amountFract = ingredientArr[1];
                    oldWeight = amount + " " + amountFract;
                    amount = parseInt(amount) + parseInt(amountFract[0]) / parseInt(amountFract[2]);
                }
                newWeight = amount * result.cup / factor;
                newWeight = Math.round(newWeight * 10) / 10;
                console.log(newWeight + " is a converted weight for " + nameOfIngredient);
                
                const convertedIngredient = ingredientArrWithSigns.join(' ')
                    .replace(oldWeight, newWeight)
                    .replace(measurementContainer, "gr");
                recipeInGramsArr.push(convertedIngredient);
                console.log(recipeInGramsArr);

            }).catch((err) => {
                console.log(err);
            })
    }
    const recipe = recipeInGramsArr.join('\n');
    return recipe;
}

function getMeasurementContainer(ingredientArr) {
    let measurementContainer = "cup";
    let factor = 1;
    let indexOfContainer = ingredientArr.indexOf("cup") // index of 'cup' is 2

    if (indexOfContainer < 0) {
        measurementContainer = "tbsp";
        factor = 16; // there are 16tbsp in a cup
        indexOfContainer = ingredientArr.indexOf("tbsp");
        if (indexOfContainer < 0) {
            factor = 48; // there are 48tsp in a cup
            measurementContainer = "tsp";
            indexOfContainer = ingredientArr.indexOf("tsp");
            if (indexOfContainer < 0) {
                console.log(indexOfContainer + " is index, the ingredient doesn't exist")
                return ["no container", -1];
            }
        }
        console.log(measurementContainer + " has index " + indexOfContainer)
    }
    return [measurementContainer, indexOfContainer, factor];
}

async function getProductName(ingredientArr, indexOfContainer) {
    console.log(ingredientArr)
    let firstMatch = [];
    let finalMatch = [];
    let ingredientNameArr = [];
    let nameOfIngredient;

    try {
        for (let i = indexOfContainer + 1; i < ingredientArr.length; i++) {
            firstMatch = await Ingredient.find({ name: ingredientArr[i] });
            if (firstMatch.length > 0) {
                console.log(firstMatch + " is a first match the ingredient name with database");
                nameOfIngredient = firstMatch[0].name;  // like nameOfIngredient = sugar
                // get a specification for the ingredient
                let name = nameOfIngredient;
                ingredientNameArr.push(nameOfIngredient);
                for (let j = i - 1; j > indexOfContainer; j--) {
                    ingredientNameArr.unshift(ingredientArr[j]);
                    console.log(ingredientNameArr);
                    name = ingredientArr[j] + " " + name;
                    console.log(name + " is a name")
                    finalMatch = await Ingredient.find({ name: name });
                    if (finalMatch.length > 0) {
                        console.log(finalMatch + " is a next match, we went to the left");
                        return nameOfIngredient = finalMatch[0].name; // like nameOfIngredient = brown sugar
                    }
                }
                for (let j = i + 1; j < ingredientArr.length; j++) {
                    ingredientNameArr.unshift(ingredientArr[j]);
                    console.log(ingredientNameArr);
                    name += " " + ingredientArr[j];
                    finalMatch = await Ingredient.find({ name: name });
                    if (finalMatch.length > 0) {
                        console.log(finalMatch + " is a next match, we went to the right");
                        return nameOfIngredient = finalMatch[0].name; // like nameOfIngredient = brown sugar
                    }
                }
            } else if (firstMatch.length === 0) {
                console.log("checking here, there is no firstmatch")
                let name = ingredientArr[i];
                for (let k = i + 1; k < ingredientArr.length; k++) {
                    name += " " + ingredientArr[k]
                    console.log(name + " is a name");
                    finalMatch = await Ingredient.find({ name: name });
                    if (finalMatch.length > 0) {
                        nameOfIngredient = finalMatch[0].name;
                    }
                }
            }
        }
    } catch (err) {
        console.log(err);
    }

    console.log(nameOfIngredient + " is nameOfIngredient")
    return nameOfIngredient;
}
module.exports = { handleMessage };

