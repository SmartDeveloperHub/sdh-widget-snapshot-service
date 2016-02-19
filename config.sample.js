var config = {};

config.port = 8888; // Port to start listening in

config.phantom = {};
config.phantom.workers = 1; // Number of phantom processes
config.phantom.executors_per_worker = 1; // Number of executors (something like "browsers") per process
config.phantom.start_port = 45032; // The port in which it will start lookin for available ports to assign to each worker

module.exports = config;