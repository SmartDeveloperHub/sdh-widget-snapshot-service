var config = {};

config.port = 8888; // Port to start listening in

config.persistence = {};
config.persistence.prefix = "wss_image_";
config.persistence.directory = "/tmp/";
config.persistence.max_size = 10485760; //10MB in bytes
config.persistence.free_percentage = 90; //When the maximum is reached, try to free space to reduce (at most) to that percentage of used space
                                         //Example: with max_size = 10MB, and free_percentage = 90, it will free space
                                         // to keep more that a 90% of used space
config.persistence.redis = {};
config.persistence.redis.host = "127.0.0.1";
config.persistence.redis.port = 6379;

config.phantom = {};
config.phantom.workers = 1; // Number of phantom processes
config.phantom.executors_per_worker = 1; // Number of executors (something like "browsers") per process
config.phantom.start_port = 45032; // The port in which it will start lookin for available ports to assign to each worker
config.phantom.timeout = 20000; // Timeout in milliseconds per execution in the "browser"

module.exports = config;