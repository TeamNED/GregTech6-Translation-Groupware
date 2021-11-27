#ifndef GENERATORMETA_H
#define GENERATORMETA_H
#pragma once

#include "IGeneratorMeta.hpp"

class GeneratorMeta : public IGeneratorMeta {
private:
  string _group, _namespace_prefix;
  bool _cached = true, _completed = true;
  set<string> _extensions;

public:
  GeneratorMeta() = default;
  GeneratorMeta(const IGeneratorMeta &);
  GeneratorMeta(string group, string namespace_prefix, bool cached,
                bool completed, set<string> extensions);
  GeneratorMeta(const GeneratorMeta &) = default;
  GeneratorMeta(GeneratorMeta &&) = default;
  GeneratorMeta &operator=(const GeneratorMeta &) = default;
  GeneratorMeta &operator=(GeneratorMeta &&) = default;
  virtual ~GeneratorMeta() = default;

  virtual string &group();
  virtual string &namespace_prefix();
  virtual bool &cached();
  virtual bool &completed();
  virtual set<string> &extensions();

  virtual const string &group() const override;
  virtual const string &namespace_prefix() const override;
  virtual bool cached() const override;
  virtual bool completed() const override;
  virtual const set<string> &extensions() const override;

  virtual GeneratorMeta &operator+=(const IGeneratorMeta &that) override;
  virtual bool equals(const IGeneratorMeta &that) const override;
  virtual bool empty() const override;
};
#endif