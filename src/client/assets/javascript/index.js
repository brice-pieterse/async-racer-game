
var store = {
	track_id: undefined,
	player_id: undefined,
	race_id: undefined,
	segments: null,
}

document.addEventListener("DOMContentLoaded", function() {
	onPageLoad()
	setupClickHandlers()
})

async function onPageLoad() {
	try {
		getTracks()
			.then(res => res.json())
			.then(tracks => {
				const html = renderTrackCards(tracks)
				renderAt('#tracks', html)
			})

		getRacers()
			.then(res => res.json())
			.then((racers) => {
				const html = renderRacerCars(racers)
				renderAt('#racers', html)
			})
	} catch(error) {
		console.log("Problem getting tracks and racers ::", error.message)
		console.error(error)
	}
}

function setupClickHandlers() {
	document.addEventListener('click', function(event) {
		const { target } = event
		const startBtn = document.querySelector(".button.start")

		// Race track form field
		if (target.matches('.card.track')) {
			handleSelectTrack(target)
			if (store.track_id && store.player_id){
				startBtn.style.opacity = "1"
			}
		}

		// Podracer form field
		if (target.matches('.card.podracer')) {
			handleSelectPodRacer(target)
			if (store.track_id && store.player_id){
				startBtn.style.opacity = "1"
			}
		}

		// Submit create race form
		if (target.matches('#submit-create-race')) {
			event.preventDefault()
			if (store.player_id && store.track_id){
				handleCreateRace()
			}
		}

		// Handle acceleration click
		if (target.matches('#gas-peddle')) {
			handleAccelerate(target)
		}

	}, false)
}

async function delay(ms) {
	try {
		return await new Promise(resolve => setTimeout(resolve, ms));
	} catch(error) {
		console.log("an error shouldn't be possible here")
		console.log(error)
	}
}


async function handleCreateRace() {

	const { player_id, track_id } = store;
	
	renderAt('#race', renderRaceStartView(track_id))

	createRace(player_id, track_id)
	.then(async (race) => {
		let segments = await prepareSegments(race)
		store = Object.assign(store, { race_id: race.ID, segments: segments })
		return race.ID;
	})
	.then(async (raceID) => {
		await runCountdown()
		await startRace(raceID)
		await runRace(raceID)
	})
}


function runRace(raceID) {
	return new Promise(resolve => {
	let raceInterval = setInterval(() => {
		getRace(raceID)
		.then((res) => {
			if (res.status === "in-progress"){
				updatePositions(res);
				renderAt('.leaderboard-wrapper', raceProgress(res.positions))
			}
			if (res.status === "finished"){
				updatePositions(res);
				renderAt('.leader-modal', resultsView(res.positions))
				clearInterval(raceInterval);
				resolve();
			}
		})
		.catch(err => console.log(err))
	}, 250)
	})
	.catch(err => console.log(err))
}

async function runCountdown() {
	try {
		let timer = 3
		return new Promise(resolve => {
		let counter = setInterval(() => {
			document.getElementById('big-numbers').innerHTML = --timer
			if (timer === 0){
				clearInterval(counter)
				resolve();
			}
		}, 1000)
		})
		.then(() => {
			const countdown = document.querySelector(".countdown-wrapper")
			countdown.style.display = "none"
		})
	} catch(error) {
		console.log(error);
	}
}

function handleSelectPodRacer(target) {

	const selected = document.querySelector('#racers .selected')
	if(selected) {
		selected.classList.remove('selected')
	}

	target.classList.add('selected')

	store = Object.assign(store, { player_id: target.id })
}

function handleSelectTrack(target) {

	const selected = document.querySelector('#tracks .selected')
	if (selected) {
		selected.classList.remove('selected')
	}

	target.classList.add('selected')

	store = Object.assign(store, { track_id: target.id })
	
}

const handleAccelerate = (() => {
	let lastclick = new Date();
	return () => {
		let newclick = new Date();
		if (newclick - lastclick >= 1000){
			btn = document.getElementById("gas-peddle")
			lastclick = newclick;
			shakePedal(btn)
		}
		accelerate(store.race_id)
	}
})()

const shakePedal = (btn) => {
	btn.style.transform = "rotate(5deg)"
		setTimeout(()=> {
			btn.style.transform = "rotate(-5deg)"
				setTimeout(()=>{
					btn.style.transform = "rotate(0deg)"
					setTimeout(()=>{
						return
					}, 200)
				}, 200)
		}, 200)
}

function prepareSegments(race){
	return new Promise((resolve) => {
		let segments = race.Track.segments.length;
		resolve(segments)
	})
	.catch(err => console.log(err))
}

function updatePositions(race){
	const segments = store.segments
	for (let car of race.positions){
		const racer = document.querySelector(`.racer-colour-${car.id}`)
		let progress = car.segment/segments
		progress = progress.toFixed(3)
		progress = parseFloat(progress * 100)
		racer.style.left = `${-100 + progress}%`
	}
}

// HTML VIEWS ------------------------------------------------

function renderRacerCars(racers) {
	if (!racers.length) {
		return `
			<h4>Loading Racers...</4>
		`
	}
	const results = racers.map(renderRacerCard).join('')
	return `
		<ul id="racers">
			${results}
		</ul>
	`
}

function renderRacerCard(racer) {
	const { id, driver_name, top_speed, acceleration, handling } = racer
	return `
		<li class="card podracer" id="${id}">
			<h3>${driver_name}</h3>
			<p>Speed: ${top_speed}</p>
			<p>Acceleration: ${acceleration}</p>
			<p>Handling: ${handling}</p>
		</li>
	`
}

function renderTrackCards(tracks) {
	if (!tracks.length) {
		return `
			<h4>Loading Tracks...</4>
		`
	}

	const results = tracks.map(renderTrackCard).join('')

	return `
		<ul id="tracks">
			${results}
		</ul>
	`
}

function renderTrackCard(track) {
	const { id, name } = track

	return `
		<li id="${id}" class="card track">
			<h3>${name}</h3>
		</li>
	`
}

function renderCountdown(count) {
	return `
	<div class="start-modal">
		<h2>Race Starts In...</h2>
		<p id="big-numbers">${count}</p>
	</div>
	`
}

function renderRaceStartView(trackId, racers) {
	
	return `
		<div class="race-track">
			<div class="racer-colour-1 racer"></div>
			<div class="racer-colour-2 racer"></div>
			<div class="racer-colour-3 racer"></div>
			<div class="racer-colour-4 racer"></div>
			<div class="racer-colour-5 racer"></div>
			<div id="accelerate">
				<button id="gas-peddle"></button>
			</div>
		</div>
		<div class="leaderboard-wrapper">
			<div class="leader-modal">
				<h2>Leaderboard</h2>
				<div class="divider-line"></div>
				<img src="assets/images/racers.jpg" style="width:100%">
			</div>
		</div>
		<div class="countdown-wrapper">
			${renderCountdown(3)}
		</div>
	`
}

function resultsView(positions) {

	let userPlayer = positions.find(e => e.id === parseInt(store.player_id))
	userPlayer.driver_name += " (you)"
	positions = positions.sort((a, b) => (a.final_position < b.final_position) ? -1 : 1)
	let count = 1

	const results = positions.map(p => {
		let markup = `
			<tr>
				<td>
					<h3 class="racer-name player-${p.id}">${count++} - ${p.driver_name}</h3>
				</td>
			</tr>
		`
		return markup
	})

	positions.sort((a, b) => (a.final_position > b.final_position) ? 1 : -1)

	return `
		<h2>Race Results</h2>
		<div class="divider-line"></div>
		<section id="leaderBoard">
			${results.join("")}
			<a id="create-new-race" href="/race"></a>
		</section>
	`
}

function raceProgress(positions) {


	let userPlayer = positions.find(e => e.id === parseInt(store.player_id))
	userPlayer.driver_name += " (you)"

	let leaders = []
	const finished = positions.filter((c) => {return (c.final_position ? true : false) }).sort((a,b) => (a.final_position > b.final_position) ? 1 : -1)

	const rest = positions.filter((c) => {return (!c.final_position ? true : false) }).sort((a, b) => (a.segment > b.segment) ? -1 : 1)

	leaders = leaders.concat(finished, rest)

	let count = 1
	const segments = store.segments

	const results = leaders.map(p => {
		let progress = p.segment/segments
		progress = progress.toFixed(3)
		progress = parseFloat(progress * 100)
		if (progress === 100){
			p.driver_name += " (finished)"
		}

		let markup = `
			<tr>
				<td>
					<h3 class="racer-name player-${p.id}">${count++} - ${p.driver_name}</h3>
				</td>
			</tr>
		`
		return markup
	})

	return `
	<div class="leader-modal">
			<h2>Leaderboard</h2>
			<div class="divider-line"></div>
			<section id="leaderBoard">
				${results.join("")}
			</section>
	</div>
	`
}

function renderAt(element, html) {
	const node = document.querySelector(element)

	node.innerHTML = html
}



// API CALLS ------------------------------------------------

const SERVER = 'http://localhost:8000'

function defaultFetchOpts() {
	return {
		mode: 'cors',
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin' : SERVER,
		},
	}
}


function getTracks() {
	return fetch(`${SERVER}/api/tracks`, {
		method: `GET`,
		...defaultFetchOpts()
	})
}

function getRacers() {
	return fetch(`${SERVER}/api/cars`,{
		method: `GET`,
		...defaultFetchOpts()
	})
}

function createRace(player_id, track_id) {
	let id = Math.random()*10000
	id = Math.round(id)

	player_id = parseInt(player_id)
	track_id = parseInt(track_id)
	const body = { player_id, track_id, race_id: id}
	
	return fetch(`${SERVER}/api/races`, {
		method: 'POST',
		...defaultFetchOpts(),
		dataType: 'jsonp',
		body: JSON.stringify(body)
	})
	.then(res => res.json())
	.catch(err => console.log("Problem with createRace request::", err))
}

function getRace(id) {
	return fetch(`${SERVER}/api/races/${id-1}`, {
		method: `GET`,
		...defaultFetchOpts()
	})
	.then(res => res.json())
	.catch(err => console.log(err))
}

function startRace(id) {
	// server bug with race ID ?
	return fetch(`${SERVER}/api/races/${id-1}/start`, {
		method: 'POST',
		...defaultFetchOpts(),
	})
	.then(res => res.json())
	.catch(err => console.log("Problem with getRace request::", err))
}


function accelerate(id) {
	fetch(`${SERVER}/api/races/${id-1}/accelerate`, {
		method: 'POST',
		...defaultFetchOpts()
	})
}
