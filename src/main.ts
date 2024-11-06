// test commit
const testButton = document.createElement("button");
testButton.textContent = "Test";
document.body.appendChild(testButton);
testButton.addEventListener("click", () => {
  console.log("Test");
  alert("You clicked the button!");
});
