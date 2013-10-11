(ns agent
  (:require [cljs.nodejs :as node]))

(def Client (node/require "bzrflag-client"))

(def setTimeout (js* "setTimeout"))

(def port 50102)
(def host "localhost")
(def debug false)

(defn get-updated-world
  [client callback]
  (.getMyTanks client
    (fn [myTanks] (.getObstacles client
      (fn [obstacles] (.getFlags client
        (fn [flags] (.getShots client
          (fn [shots] (.getOtherTanks client
            (fn [otherTanks] (.getBases client
              (fn [bases] (callback {:myTanks myTanks
                                     :obstacles obstacles
                                     :flags flags
                                     :shots shots
                                     :otherTanks otherTanks
                                     :bases bases}))))))))))))))


;(defn stop-turn-then-go-straight
;  [client tanks]
;  (println "inside stop")
;  (doseq [tank tanks]
;    (let [tank-index (.-index tank)]
;      (println "Telling tank" tank-index "to stop.")
;      (.speed client tank-index 0))))
;

(def Kp 1)
(def Kd 1)

(defn pd-controller
  [yt xt prev-yt prev-xt time-change]
  (+ (* Kp (- yt xt)) (* Kd (/ (- (yt - xt) (prev-yt prev-xt)) time-change))))

(defn turn-tank-to-degree
  [client tank-index degree]
  (get-updated-world client
                     (fn [world]



(defn potential-field
  [x y world]
  ())

(defn really-dumb-agent
  [client]
  (get-updated-world client
                     (fn [world]
                       (println world)
                       (doseq [tank (world :myTanks)]
                         (let [tank-index (.-index tank)]
                           (println (JSON.stringify tank))
                           (println "Telling tank" tank-index "to move.")
                           (.speed client tank-index 1)))
                       ;(setTimeout #(stop-turn-then-go-straight client tanks) 5000)
                       )))

(defn -main [& args]
  (let [client (new Client port host debug)]
    (really-dumb-agent client)))


(set! *main-cli-fn* -main)
