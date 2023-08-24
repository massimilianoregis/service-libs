const {Pet} = require("./object");
const {Rest} = require("../http/rest");
var app = require("express")();
    app.get("/populate",async (req,res,next)=>{
        var animal=await Pet.new({
            name:"wisky"
        })
        res.json(animal);
    })
    app.use(new Rest(Pet).app)
app.listen(4000);
console.log("listen on port 4000")