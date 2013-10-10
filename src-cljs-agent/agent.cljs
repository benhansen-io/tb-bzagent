(ns agent
	(:require [cljs.nodejs :as node]))

(def client (node/require "bzrflag-client"))

(defn -main [& args]
  (println client))

(set! *main-cli-fn* -main)