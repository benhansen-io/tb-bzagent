(ns agent
  (:require [cljs.nodejs :as node]))

(def Client (node/require "bzrflag-client"))

(def port 50102)
(def host "localhost")
(def debug true)

(defn really-dumb-agent
  [client tanks]
  (println client tanks)
  (for [tank tanks]
    (let [tank-index (.-index tank)]
      (println "Telling tank" tank-index "to move.")
      (.speed client tank-index 1))))

(defn -main [& args]
  (let [client (new Client port host debug)]
    (.getMyTanks client (fn [tanks] (really-dumb-agent client tanks)))))


(set! *main-cli-fn* -main)
