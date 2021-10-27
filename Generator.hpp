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
  Generator() = default;
  Generator(string group, string namespace_prefix, bool cached, bool completed,
            vector<string> extensions);
  Generator(const Generator &) = default;
  Generator(Generator &&) = default;
  Generator &operator=(const Generator &) = default;
  Generator &operator=(Generator &&) = default;
  virtual ~Generator() = default;

  virtual string &group();
  virtual string &namespace_prefix();
  virtual bool &cached();
  virtual bool &completed();
  virtual vector<string> &extentions();
};
#endif