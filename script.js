// Importing types for TypeScript support
/// <reference types="jquery" />
/// <reference types="@geps/geofs-types" />

// Function to wait for a condition to be true
async function waitForCondition(checkFunction) {
  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      if (checkFunction()) {
        // Check if the condition is met
        clearInterval(intervalId); // Stop checking
        resolve(); // Resolve the promise
      }
    }, 100); // Check every 100 milliseconds
  });
}

// Function to wait until the UI is ready
async function waitForUI() {
  return waitForCondition(() => typeof ui !== "undefined"); // Checks if 'ui' is defined
}

// Function to wait until the aircraft instance is ready
async function waitForInstance() {
  return waitForCondition(() => geofs.aircraft && geofs.aircraft.instance); // Checks if aircraft instance exists
}

// Function to wait until the instruments are available
async function waitForInstruments() {
  return waitForCondition(
    () => instruments && geofs.aircraft.instance.setup.instruments // Checks if instruments are set up
  );
}

// Main function to handle the autospoilers functionality
async function autospoilers() {
  await waitForUI(); // Wait for the UI to be ready
  await waitForInstance(); // Wait for the aircraft instance to be ready

  // Show a notification about the new spoiler arming key
 // ui.notification.show("Note: spoiler arming key has now changed to Shift.");

  // Initialize the spoiler arming status
  geofs.aircraft.instance.animationValue.spoilerArming = 0;

  // Function to toggle spoiler arming status
  const toggleSpoilerArming = () => {
    // Check if the aircraft is not on the ground and airbrakes are off
    if (
      !geofs.aircraft.instance.groundContact &&
      controls.airbrakes.position < 0.03 
    ) {
      // Toggle the spoiler arming value between 0 and 1
      geofs.aircraft.instance.animationValue.spoilerArming =
        geofs.aircraft.instance.animationValue.spoilerArming === 0 ? 1 : 0;
    }
  };

  // Function to toggle airbrakes
  const toggleAirbrakes = () => {
    // Toggle airbrakes position between 0 and 1
    //need to override the spoiler controls first
    controls.airbrakes.target = controls.airbrakes.target === 0 ? 1 : 0;
    controls.setPartAnimationDelta(controls.airbrakes); // Update the animation delta
    geofs.aircraft.instance.animationValue.spoilerArming = 0; // Reset spoiler arming
  };

  // Define control setter for spoiler arming
  controls.setters.setSpoilerArming = {
    label: "Spoiler Arming", // Label for the control
    set: toggleSpoilerArming, // Function to execute when toggled
  };

  // Define control setter for airbrakes
  controls.setters.setAirbrakes = {
    label: "Air Brakes", // Label for the control
    set: toggleAirbrakes, // Function to execute when toggled
  };

  await waitForInstruments(); // Wait for the instruments to be available

  // Set up an overlay for the spoilers in the instruments
  instruments.definitions.spoilers.overlay.overlays[3] = {
    anchor: { x: 0, y: 0 }, // Position of the overlay
    size: { x: 50, y: 50 }, // Size of the overlay
    position: { x: 0, y: 0 }, // Initial position of the overlay
    animations: [
      { type: "show", value: "spoilerArming", when: [1] }, // Show conditions
      { type: "hide", value: "spoilerArming", when: [0] }, // Hide conditions
    ],
    class: "control-pad-dyn-label green-pad", // CSS class for styling
    text: "SPLR<br/>ARM", // Text to display on the overlay
    drawOrder: 1, // Draw order for layering
  };

  instruments.init(geofs.aircraft.instance.setup.instruments); // Initialize the instruments
  //set the camera again
  let camera = geofs.camera.currentMode;
  let fov = geofs.camera.currentFOV;
  window.geofs.camera.set(camera);
  window.geofs.camera.setFOV(fov);


  // Event listener for keyboard events
  $(document).keydown(function (e) {
    if (e.which === 16 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Check if the "Shift" key is pressed
      console.log("Toggled Arming Spoilers"); // Log the action
      controls.setters.setSpoilerArming.set(); // Execute the toggle function
    }
  });
//START OF JOYSTICK SUPPORTED CODE//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let throttleOverridden = false;
let currentThrottleJoystickInput = 0;
let revThrottleOverridden = false;
let currentRevThrottleJoystickInput = 0;
let spoilersOverridden = false;
let currentSpoilersJoystickInput = 0;


if (!controls.axisSetters.throttle.__original) {
    controls.axisSetters.throttle.__original = controls.axisSetters.throttle.process;
}
if (!controls.axisSetters.throttlereverse.__original) {
    controls.axisSetters.throttlereverse.__original = controls.axisSetters.throttlereverse.process;
}
if (!controls.axisSetters.airbrakesPosition.__original) {
    controls.axisSetters.airbrakesPosition.__original = controls.axisSetters.airbrakesPosition.process;
}

controls.axisSetters.throttle.process = function (e, t) {
    // Always track joystick input
    currentThrottleJoystickInput = e;
    //console.log(currentThrottleJoystickInput)
    if (throttleOverridden) {
        // block joystick from reaching sim
        return;
    }
    controls.axisSetters.throttle.__original(e, t);
};
controls.axisSetters.throttlereverse.process = function (e, t) {
    // Always track joystick input
    currentRevThrottleJoystickInput = e;
    //console.log(currentRevThrottleJoystickInput)
    if (revThrottleOverridden) {
        // block joystick from reaching sim
        return;
    }
    controls.axisSetters.throttlereverse.__original(e, t);
};
controls.axisSetters.airbrakesPosition.process = function (e, t) {
    // Always track joystick input
    currentSpoilersJoystickInput = e;
    //console.log(currentSpoilersJoystickInput)
    if (spoilersOverridden) {
        // block joystick from reaching sim
        return;
    }
    controls.axisSetters.airbrakesPosition.__original(e, t);
};


setInterval(function () {
  // Check for landing + reversers
  if (
    geofs.aircraft.instance.animationValue.spoilerArming === 1 &&
    geofs.aircraft.instance.groundContact &&
    !throttleOverridden &&
    !spoilersOverridden
  ) { //deploy spoilers and reverse thrust. only runs once on touchdown
    if (controls.airbrakes.position < 0.03) {
        spoilersOverridden = true;
        const originalSpoilers = controls.axisSetters.airbrakesPosition.process;
        window.lastSpoilersInput = currentSpoilersJoystickInput;
        controls.setters.setAirbrakes.set(); //deploy spoilers
    } 
    geofs.aircraft.instance.animationValue.spoilerArming = 0;

    // Arm reverse thrust takeover
    throttleOverridden = true; //switch to dummy throttle
    const originalThrottle = controls.axisSetters.throttle.process; //original throttle logic
    window.lastThrottleInput = currentThrottleJoystickInput; //save throttle at the moment of touchdown
    revThrottleOverridden = true; //switch to dummy throttle
    const originalRevThrottle = controls.axisSetters.throttlereverse.process; //original throttle logic
    window.lastRevThrottleInput = currentRevThrottleJoystickInput; //save throttle at the moment of touchdown

    setTimeout(() => {
      geofs.autopilot.turnOff();
      $(document).trigger("autothrottleOff");
    }, 200);
    setTimeout(() => {
      controls.throttle = -9; // reverse thrust
    }, 200);
  } //end of deploying spoilers and reverse thrust

  // --- Detect joystick movement to restore throttle control ---
  if (throttleOverridden) {
    if (Math.abs(currentThrottleJoystickInput - window.lastThrottleInput) > 0.01) { // buffer for noise
      // restore
      throttleOverridden = false;
      console.log("throttle control handed back to pilot");
    }
  }  
  if (revThrottleOverridden) {
    if (Math.abs(currentRevThrottleJoystickInput - window.lastRevThrottleInput) > 0.01) { // buffer for noise
      // restore
      revThrottleOverridden = false;
      console.log("throttle/reverse control handed back to pilot");
    }
  }
    // --- Detect joystick movement to restore spoilers control ---
  if (spoilersOverridden) {
    if (Math.abs(currentSpoilersJoystickInput - window.lastSpoilersInput) > 0.01) { // buffer for noise
      // restore
      spoilersOverridden = false;
      console.log("spoilers control handed back to pilot");
    }
  }


    if (geofs.aircraft.instance.animationValue.spoilerArming === 1 && controls.airbrakes.position > 0.03) {
        geofs.aircraft.instance.animationValue.spoilerArming = 0; // Reset spoiler arming
    }

  }, 100); // Run this check every 100 milliseconds
//END OF JOYSTICK SUPPORTED CODE/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Interval to ensure instruments are set up correctly for specific aircraft IDs
  setInterval(function () {
    // Check if the aircraft ID is known and instruments are not initialized
    if (
      ["3292", "3054"].includes(geofs.aircraft.instance.id) &&
      geofs.aircraft.instance.setup.instruments["spoilers"] === undefined
    ) {
      geofs.aircraft.instance.setup.instruments["spoilers"] = ""; // Initialize spoilers instrument
      instruments.init(geofs.aircraft.instance.setup.instruments); // Reinitialize instruments
    }
  }, 500); // Run this check every 500 milliseconds
}

// Call the autospoilers function to start the script
autospoilers();



