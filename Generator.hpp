#ifndef GENERATOR_H
#define GENERATOR_H
#pragma once

#include <string>
#include <vector>
using std::string;
using std::vector;

class Generator {
private:
  string _group, _namespace_prefix;
  bool _cached, _completed;
  vector<string> _extentions;

public:
  Generator(string group, string namespace_prefix, bool cached, bool completed,
            vector<string> __extentions);
  ~Generator();
  const string &group();
  const string &namespace_prefix();
  bool cached();
  bool completed();
  const vector<string> extentions();
};
#endif