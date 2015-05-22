/**
 * Created by zaephor on 3/21/15.
 */

var BSON = require('mongodb').BSONPure;
var ImEnabled = false;
var _ = require('underscore');

/* The ServerSide API connection to get appropriate data for all the below chunks */
exports.api = function (db) {
    return function (req, res) {
        if (typeof req.session.currentUser == "undefined") {
            res.json({error:"No session"});
        } else {
            var users = db.get("accounts");
            var likes = db.get("likes");
            var categories = ["Friends", "Books", "Movies", "Searches"];

            var reply = {
                existingfriends: function (userid, offset, limit, sort) {
                    // Get list of friend objects, sort them according to SORT, start at the OFFSET and return LIMIT many afterwards
                    //var temp = users.slice(offset, offset + limit);
                    var p_id = BSON.ObjectID.createFromHexString(req.session.currentUser._id);
                    users.find({"_id": {$nin: [p_id]}}, '-password', function (err, data) {
                        var userIDList = _.pluck(data, '_id');
                        userIDList = _.map(userIDList, function (value) {
                            return value.toString()
                        });
                        console.log(userIDList);
                        likes.find({"userRec._id": userid}, '-userRec -CreatedBy -EnteredOn -_id', function (err, userlikes) { // First get logged in user's data
                            likes.find({"userRec._id": {$in: userIDList}}, '-CreatedBy -EnteredOn -_id', function (err, allLikes) { // Find other users data
                                var output = [];
                                for (i = 0; i < userIDList.length; i++) {
                                    /*
                                     console.log({allLikes:allLikes});
                                     console.log(_.filter(allLikes,function(item){return item.userRec._id == userIDList[i]._id;}));
                                     var otherlikes = [];
                                     for(j=0;j<allLikes.length;j++){
                                     if(allLikes[j].userRec._id == userIDList[i]._id){
                                     otherlikes[j] = allLikes[j];
                                     }
                                     }
                                     */
                                    var fauxMatches = {};
                                    _.each(categories, function (category) {
                                        fauxMatches[category] = Math.floor(Math.random() * 100);
                                    });
                                    output[i] = {
                                        _id: data[i]._id,
                                        username: data[i].username,
                                        match: fauxMatches
                                    };
                                }
                                console.log(output);
                                res.json(output.slice(offset, offset + limit));
                            });
                        });
                    });
                },

                findfriends: function (username, offset, limit, sort) {
                    // Get list of users related to username, sort according to SORT, start at the OFFSET and return LIMIT many afterwards
                    //var temp = users.slice(offset, offset + limit);
                    var p_id = BSON.ObjectID.createFromHexString(req.session.currentUser._id);
                    users.find({
                        "_id": {$nin: [p_id]},
                        username: {$regex: new RegExp(username.toLowerCase(), "i")}
                    }, '-password', function (err, data) {
                        var output = [];
                        for (i = 0; i < data.length; i++) {
                            var fauxMatches = {};
                            _.each(categories, function (category) {
                                fauxMatches[category] = Math.floor(Math.random() * 100);
                            });
                            output[i] = {
                                _id: data[i]._id,
                                username: data[i].username,
                                match: fauxMatches
                            };
                        }
                        res.json(output.slice(offset, offset + limit));
                    });
                },

                discoverfriends: function (userid, offset, limit, sort) {
                    // List of users should have high similarity rankings to logged in user... not sure on how to do that yet
                    // Get list of users, sort according to SORT, start at OFFSET and return LIMIT many afterwards
                    var p_id = BSON.ObjectID.createFromHexString(req.session.currentUser._id);
                    users.find({"_id": {$nin: [p_id]}}, '-password', function (err, data) {
                        var output = [];
                        for (i = 0; i < data.length; i++) {
                            var fauxMatches = {};
                            _.each(categories, function (category) {
                                fauxMatches[category] = Math.floor(Math.random() * 100);
                            });
                            output[i] = {
                                _id: data[i]._id,
                                username: data[i].username,
                                match: fauxMatches
                            };
                        }
                        res.json(output.slice(offset, offset + limit));
                    });
                },
                deletefriend: function (friendid) {
                    // remove relationship between logged in user and the friendid
                    return {result: "deleted", error: "none"};
                },
                addfriend: function (friendid) {
                    // Create relationship between logged in user and the friendid
                    return {result: "added", error: "none"};
                }
            };

            var utility = {
                compareLikes: function (data, data2) {
                    console.log({data: data, data2: data2});
                    data = _.pick(data, {});
                    data2 = _.pick(data2, {});
                    // Not sure why, but uniq seems to be doing unions/intersections for some reason...
                    var allCommon = _.uniq(data, data2);
                    if (data.length > 0 && data2.length > 0) {
                        var all = Math.floor((allCommon.length / data.length) * 100);
                    } else {
                        var all = 0;
                    }

                    var moviesA = _.where(data, {category: "Movies"});
                    var moviesB = _.where(data2, {category: "Movies"});
                    var moviesCommon = _.uniq(moviesA, moviesB);
                    var movies = Math.floor((moviesCommon.length / moviesA.length) * 100);
                    if (_.isNaN(movies)) {
                        movies = 0;
                    }

                    var booksA = _.where(data, {category: "Books"});
                    var booksB = _.where(data2, {category: "Books"});
                    var booksCommon = _.uniq(booksA, booksB);
                    var books = Math.floor((booksCommon.length / booksA.length) * 100);
                    if (_.isNaN(books)) {
                        books = 0;
                    }

                    var friendsA = _.where(data, {category: "Friends"});
                    var friendsB = _.where(data2, {category: "Friends"});
                    var friendsCommon = _.uniq(friendsA, friendsB);
                    var friends = Math.floor((friendsCommon.length / friendsA.length) * 100);
                    if (_.isNaN(friends)) {
                        friends = 0;
                    }

                    matches = [{"All": all}, {"Movies": movies}, {"Books": books}, {"Friends": friends}, {"Searches": 0}]
                    //console.log(matches);
                    return matches;
                }
            };

            var action = req.params.action.toLowerCase();
            if (typeof reply[action] != "undefined") {
//        console.log(req);
                // Get logged in user's #id number
                var extra = req.session.currentUser._id; // TODO: loggedInUserID, should be pulled from user session somewhere
                if (typeof req.body.extra !== "undefined") { // If API passsed an "extra" param, means that we need to search something specific
                    /* for existingfriends and discoverfriends, extra should not be set, but for searches in findfriends, extra should be set */
                    extra = req.body.extra;
                }
                if (reply[req.params.action.toLowerCase()].length == 4) {
                    var temp = reply[req.params.action.toLowerCase()](extra, req.body.offset, req.body.limit, 'default');
                    if (typeof temp == "object") {
                        res.json(temp);
                    }
                } else if (reply[req.params.action.toLowerCase()].length == 1) {
                    res.json(reply[req.params.action.toLowerCase()](extra));
                } else {
                    res.json({error: "Invalid request"});
                }
            } else { // api function doesn't exist
                res.json({error: "Invalid request"});
            }
        }
    };
};

/* List user's current friends */
exports.list = function (req, res) {
    if (typeof req.session.currentUser == "undefined") {
        res.redirect(307, "/login");
    } else {
        res.render('friend/list', {
            title: 'Friend List',
            currentUser: req.session.currentUser
        });
    }
};
/* Display the find-people screen */
exports.find = function (req, res) {
    if (typeof req.session.currentUser == "undefined") {
        res.redirect(307, "/login");
    } else {
        res.render('friend/find', {
            title: 'Friend Search Prompt and Results',
            currentUser: req.session.currentUser
        });
    }
};
/* Display recommended friends */
exports.discover = function (req, res) {
    if (typeof req.session.currentUser == "undefined") {
        res.redirect(307, "/login");
    } else {
        res.render('friend/discover', {
            title: 'Recommended Friends/Discover Friends',
            currentUser: req.session.currentUser
        });
    }
};
