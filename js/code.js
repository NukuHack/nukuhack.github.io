
/*
apple.get("text.txt", function(data) {
    let items = data.split(';');
});
*/

let Data;

// just the json fetch
function fetchData() {
    fetch('./json/data.json')
        .then((res) => {
            if (!res.ok) {
                throw new Error
                (`HTTP error status: ${res.status}`);
            }
            return res.json();
        })
        .then((amabatukam) => {
            Data = amabatukam.data;
            //console.log(Data);

        })
        .catch((error) =>{
                console.error('Json load error:', error)
        });
}


console.log("I love bread");

